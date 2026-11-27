"use server";

/**
 * Server actions of the daily cash box. Each one re-checks that the session user has the daily-cash
 * flag, parses its input with zod and runs a command scoped to that user.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDailyCash } from "@/lib/session";
import { actionFailure } from "@/modules/shared/application/action-failure";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { DailyCashError } from "../domain/box-rules";
import { parseCounts } from "../domain/cash-count";
import type { DuplicateReason } from "../domain/voucher-import";
import { dailyCashRepository } from "../infrastructure/daily-cash-repository";
import { readVoucherWorkbook } from "../infrastructure/voucher-xlsx-reader";
import { createDailyCashCommands } from "./daily-cash-commands";
import { boxSchema, countsSchema, entryUpdateSchema, expenseSchema, idSchema, incomeSchema, openingBalanceSchema } from "./daily-cash-schemas";
import { parseUploads, type ParsedUploads, type UploadedVoucher } from "./voucher-upload";

const commands = createDailyCashCommands(dailyCashRepository);

const UNIQUE = {
  daily_cash_boxes_user_date_uq: "Ya hay una caja para esa fecha.",
  daily_cash_entries_voucher_uq: "Un comprobante se guardó al mismo tiempo desde otra pantalla. Carga los archivos de nuevo.",
};

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function run(fn: (userId: string) => Promise<string>): Promise<ActionResult> {
  try {
    const session = await requireDailyCash();
    const message = await fn(session.user.id);
    // The reads are per user and uncached: refresh the screens that show them.
    revalidatePath("/caja-diaria", "layout");
    return { ok: true, message };
  } catch (e) {
    return actionFailure(e, { label: "daily cash", expected: [DailyCashError], unique: UNIQUE });
  }
}

/** Creates a box and opens it; the redirect must run outside the try/catch of `run`. */
export async function createBoxAction(fd: FormData): Promise<ActionResult> {
  let createdId: number | undefined;
  const result = await run(async (userId) => {
    const input = boxSchema.parse(formValues(fd));
    createdId = (await commands.createBox(userId, input)).id;
    return "Caja creada.";
  });
  if (result.ok && createdId !== undefined) redirect(`/caja-diaria/${createdId}`);
  return result;
}

export async function deleteBoxAction(id: number): Promise<ActionResult> {
  return run(async (userId) => {
    await commands.deleteBox(userId, idSchema.parse(id));
    return "Caja eliminada.";
  });
}

export async function closeBoxAction(id: number): Promise<ActionResult> {
  return run(async (userId) => {
    await commands.closeBox(userId, idSchema.parse(id));
    return "Caja cerrada.";
  });
}

export async function reopenBoxAction(id: number): Promise<ActionResult> {
  return run(async (userId) => {
    await commands.reopenBox(userId, idSchema.parse(id));
    return "Caja abierta de nuevo.";
  });
}

export async function setOpeningBalanceAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async (userId) => {
    const { openingBalance } = openingBalanceSchema.parse(formValues(fd));
    await commands.setOpeningBalance(userId, idSchema.parse(id), openingBalance);
    return "Saldo inicial actualizado.";
  });
}

export async function addExpenseAction(boxId: number, fd: FormData): Promise<ActionResult> {
  return run(async (userId) => {
    await commands.addExpense(userId, idSchema.parse(boxId), expenseSchema.parse(formValues(fd)));
    return "Egreso registrado.";
  });
}

export async function addIncomeAction(boxId: number, fd: FormData): Promise<ActionResult> {
  return run(async (userId) => {
    await commands.addIncome(userId, idSchema.parse(boxId), incomeSchema.parse(formValues(fd)));
    return "Ingreso registrado.";
  });
}

export async function updateEntryAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async (userId) => {
    await commands.updateEntry(userId, idSchema.parse(id), entryUpdateSchema.parse(formValues(fd)));
    return "Movimiento actualizado.";
  });
}

export async function deleteEntryAction(id: number): Promise<ActionResult> {
  return run(async (userId) => {
    await commands.deleteEntry(userId, idSchema.parse(id));
    return "Movimiento eliminado.";
  });
}

export async function saveCountsAction(boxId: number, fd: FormData): Promise<ActionResult> {
  return run(async (userId) => {
    await commands.saveCounts(userId, idSchema.parse(boxId), parseCounts(countsSchema.parse(formValues(fd))));
    return "Arqueo guardado.";
  });
}

/* ------------------------------ Excel import ------------------------------ */

const MAX_FILES = 6;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface ImportPreview {
  toImport: UploadedVoucher[];
  duplicates: Array<{ row: UploadedVoucher; reason: DuplicateReason }>;
  skipped: ParsedUploads["skipped"];
  fileErrors: ParsedUploads["fileErrors"];
}

export type ImportPreviewResult = { ok: true; preview: ImportPreview } | { ok: false; error: string };

/** The uploaded workbooks of the form, validated and read. */
async function readUploads(fd: FormData): Promise<ParsedUploads> {
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new DailyCashError("Elige al menos un archivo Excel de comprobantes.");
  if (files.length > MAX_FILES) throw new DailyCashError(`Sube máximo ${MAX_FILES} archivos a la vez.`);
  const uploaded = [];
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) throw new DailyCashError(`${file.name}: solo se aceptan archivos .xlsx.`);
    if (file.size > MAX_FILE_BYTES) throw new DailyCashError(`${file.name}: el archivo supera el límite de 2 MB.`);
    try {
      uploaded.push({ name: file.name, sheets: await readVoucherWorkbook(await file.arrayBuffer()) });
    } catch {
      throw new DailyCashError(`${file.name}: no se pudo leer el archivo. Verifica que sea un Excel válido.`);
    }
  }
  return parseUploads(uploaded);
}

/** Reads the files and says what would be imported; writes nothing. */
export async function previewVoucherImportAction(fd: FormData): Promise<ImportPreviewResult> {
  try {
    await requireDailyCash();
    const parsed = await readUploads(fd);
    const { toImport, duplicates } = await commands.previewImport(parsed.rows);
    return { ok: true, preview: { toImport, duplicates, skipped: parsed.skipped, fileErrors: parsed.fileErrors } };
  } catch (e) {
    const failure = actionFailure(e, { label: "daily cash import preview", expected: [DailyCashError] });
    return { ok: false, error: failure.error };
  }
}

/** Reads the files again (it never trusts the preview) and saves the new vouchers into the open box. */
export async function confirmVoucherImportAction(boxId: number, fd: FormData): Promise<ActionResult> {
  return run(async (userId) => {
    const parsed = await readUploads(fd);
    const { imported, duplicates } = await commands.confirmImport(userId, idSchema.parse(boxId), parsed.rows);
    const base = imported === 1 ? "1 comprobante importado" : `${imported} comprobantes importados`;
    return duplicates > 0 ? `${base}; ${duplicates === 1 ? "1 repetido se omitió" : `${duplicates} repetidos se omitieron`}.` : `${base}.`;
  });
}
