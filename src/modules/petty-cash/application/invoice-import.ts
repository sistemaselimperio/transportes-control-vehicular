/**
 * Import of the expenses of a photo or PDF of invoices: an AI reads the file, every invoice found
 * becomes an expense of the ledger marked "needs review", and each one keeps only its own pages of
 * the PDF as its attachment. The file arrives through a temporary object in storage (a scanned PDF
 * does not fit in a server-action body); it is read once and always deleted.
 */
import { randomUUID } from "node:crypto";
import { sniffFileKind } from "../domain/file-kind";
import { isPossibleDuplicate } from "../domain/invoice";
import { findSupplierNitByName } from "../domain/matching";
import { normalizeNit } from "../domain/nit";
import type { ImportSummary } from "../domain/import-message";
import { resolveOwner, resolveVehicle } from "./expense-resolvers";
import {
  ExtractorNotConfiguredError,
  type ExtractedExpense,
  type InvoiceExtractor,
  type InvoiceFile,
} from "./invoice-extractor";
import { PettyCashError, type ExpenseValues, type PettyCashPorts, type PettyCashStorage, type StoredAttachment } from "./petty-cash-commands";

export const MAX_PDF_PAGES = 15;
/** The model takes about 20 MB of file per request. */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

/** PDF page tools, behind a port so the use case is tested without a PDF library. */
export interface PdfPages {
  pageCount(data: Buffer): Promise<number>;
  /** A new PDF with only the given 1-based pages, in the given order. */
  pick(data: Buffer, pages: readonly number[]): Promise<Buffer>;
}

export type ImportStorage = PettyCashStorage & {
  /** A URL the browser can PUT one file to, without credentials. */
  createUploadUrl(path: string): Promise<string>;
};

const NO_LEDGER = "La planilla no existe.";
const clean = (text: string | null | undefined) => {
  const trimmed = (text ?? "").replace(/\s+/g, " ").trim();
  return trimmed === "" ? null : trimmed;
};

/** Pages of one invoice inside the PDF: unique, ascending, and only real ones. */
const validPages = (pages: readonly number[], pageCount: number) =>
  [...new Set(pages)].filter((n) => Number.isInteger(n) && n >= 1 && n <= pageCount).sort((a, b) => a - b);

export function createInvoiceImport(ports: PettyCashPorts, storage: ImportStorage, extractor: InvoiceExtractor, pdf: PdfPages) {
  const discard = (paths: string[]) =>
    paths.length === 0
      ? Promise.resolve()
      : storage.remove(paths).catch((err) => console.error("petty cash attachment removal failed", err));

  async function extract(file: InvoiceFile, pageCount: number | null) {
    const [owners, fleet] = await Promise.all([ports.listOwners(), ports.listFleet()]);
    try {
      const output = await extractor.extract(file, { owners, fleet, pageCount });
      return { output, owners, fleet };
    } catch (e) {
      if (e instanceof ExtractorNotConfiguredError) throw new PettyCashError("La extracción con IA no está configurada.");
      console.error("invoice extraction failed", e);
      throw new PettyCashError("No se pudo leer el archivo con IA. Intenta de nuevo.");
    }
  }

  /** Every field the model could not read stays empty for the reviewer; ids it invented are dropped. */
  function toValues(
    item: ExtractedExpense,
    context: {
      owners: Awaited<ReturnType<PettyCashPorts["listOwners"]>>;
      fleet: Awaited<ReturnType<PettyCashPorts["listFleet"]>>;
      suppliers: Awaited<ReturnType<PettyCashPorts["listSuppliers"]>>;
    },
  ) {
    const supplierName = clean(item.supplierName);
    const digits = normalizeNit(item.supplierNit ?? "");
    const readNit = /^\d{5,15}$/.test(digits) ? digits : null;
    const nit = readNit ?? findSupplierNitByName(supplierName, context.suppliers);
    const catalog = nit ? context.suppliers.find((s) => s.nit === nit) : undefined;

    const billedTo = clean(item.billedTo);
    const ownerById = item.ownerId === null ? undefined : context.owners.find((o) => o.id === item.ownerId);
    const owner = ownerById ? { ownerId: ownerById.id, company: ownerById.name } : resolveOwner(billedTo, context.owners);

    return {
      detail: clean(item.detail) ?? "Sin detalle",
      invoiceNumber: clean(item.invoiceNumber),
      efk: null,
      nit,
      supplierName: supplierName ?? catalog?.supplierName ?? null,
      responsibilityType: item.isElectronicInvoice ? ("electronic_invoicer" as const) : (catalog?.responsibilityType ?? null),
      value: item.value !== null && Number.isInteger(item.value) && item.value > 0 ? item.value : null,
      ...owner,
    };
  }

  async function vehicleOf(item: ExtractedExpense, fleet: Awaited<ReturnType<PettyCashPorts["listFleet"]>>) {
    const byId = item.vehicleId === null ? undefined : fleet.find((v) => v.id === item.vehicleId);
    if (byId) return { vehicleId: byId.id, vehicleLabel: byId.plate };
    const text = clean(item.vehiclePlate);
    if (!text) return { vehicleId: null, vehicleLabel: null };
    return resolveVehicle(ports, text);
  }

  async function attach(
    userId: string,
    source: { kind: "image" | "pdf"; mimeType: string; data: Buffer; fileName: string; pageCount: number },
    pages: readonly number[],
  ): Promise<StoredAttachment | null> {
    try {
      const base = source.fileName.replace(/\.[^./\\]+$/, "") || "factura";
      let data = source.data;
      let name = source.fileName;
      let mimeType = source.mimeType;
      if (source.kind === "pdf") {
        const own = validPages(pages, source.pageCount);
        if (own.length === 0) return null;
        data = await pdf.pick(source.data, own);
        name = `${base}-hojas-${own.join("-")}.pdf`;
        mimeType = "application/pdf";
      }
      // One object per expense: deleting one expense must never break another's attachment.
      const path = `${userId}/${randomUUID()}`;
      await storage.put(path, data, mimeType);
      return { path, name, mimeType };
    } catch (e) {
      console.error("petty cash import attachment failed", e);
      return null;
    }
  }

  return {
    /** Where the browser uploads the file to read, before calling `importExpenses`. */
    async prepareUpload(userId: string): Promise<{ path: string; uploadUrl: string }> {
      const path = `${userId}/tmp/${randomUUID()}`;
      return { path, uploadUrl: await storage.createUploadUrl(path) };
    },

    async importExpenses(userId: string, ledgerId: number, upload: { path: string; fileName: string }): Promise<ImportSummary> {
      // Only an object this user was given may be read (and deleted) here; anything else is never touched.
      if (!upload.path.startsWith(`${userId}/tmp/`) || upload.path.includes("..")) {
        throw new PettyCashError("El archivo no es válido. Súbelo de nuevo.");
      }
      try {
        // Inside the try: a stale ledger id must not leave the temporary object behind.
        if (!(await ports.findLedger(userId, ledgerId))) throw new PettyCashError(NO_LEDGER);
        const data = await storage.get(upload.path);
        if (!data) throw new PettyCashError("No se encontró el archivo subido. Intenta de nuevo.");
        if (data.length > MAX_IMPORT_BYTES) throw new PettyCashError("El archivo supera el límite de 20 MB.");
        const type = sniffFileKind(data);
        if (!type) throw new PettyCashError("Sube una foto JPG, PNG o WebP, o un PDF.");

        let pageCount = 1;
        if (type.kind === "pdf") {
          try {
            pageCount = await pdf.pageCount(data);
          } catch {
            throw new PettyCashError("No se pudo abrir el PDF. Revisa que no esté dañado.");
          }
          if (pageCount > MAX_PDF_PAGES) {
            throw new PettyCashError(`El PDF tiene ${pageCount} hojas; el máximo es ${MAX_PDF_PAGES}.`);
          }
        }

        const file: InvoiceFile = { kind: type.kind, fileName: upload.fileName, mimeType: type.mimeType, data };
        const { output, owners, fleet } = await extract(file, type.kind === "pdf" ? pageCount : null);
        const suppliers = await ports.listSuppliers();
        const source = { ...file, pageCount };

        let added = 0;
        let failed = 0;
        // One at a time: an invoice repeated inside the same file is flagged against the one saved just before.
        for (const item of output.expenses) {
          const values = toValues(item, { owners, fleet, suppliers });
          const vehicle = await vehicleOf(item, fleet);
          const sameNit = values.nit ? await ports.listInvoiceNumbers(userId, values.nit) : [];
          const row: ExpenseValues = {
            ...values,
            ...vehicle,
            needsReview: true,
            possibleDuplicate: isPossibleDuplicate(values.nit, values.invoiceNumber, sameNit),
          };
          const attachment = await attach(userId, source, item.pages);
          try {
            await ports.insertExpense(ledgerId, { ...row, attachment });
            added++;
          } catch (e) {
            console.error("petty cash import insert failed", e);
            if (attachment) await discard([attachment.path]);
            failed++;
          }
        }

        const unreadablePages =
          type.kind === "pdf" ? validPages(output.unreadablePages, pageCount) : [];
        return { added, failed, unreadablePages };
      } finally {
        await discard([upload.path]);
      }
    },
  };
}

export type InvoiceImport = ReturnType<typeof createInvoiceImport>;
