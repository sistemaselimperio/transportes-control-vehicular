"use server";

/**
 * Server actions of the cotero payments. Each one re-checks that the session user has the
 * cotero-payments flag, parses its input with zod, runs a command and expires the cached reads.
 */
import { randomUUID } from "node:crypto";
import { expireAfterAction } from "@/lib/cache-invalidation";
import { ForbiddenError } from "@/lib/permissions";
import { requireCoteroPayments } from "@/lib/session";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/modules/documents/domain/vehicle-file-rules";
import { createSignedUploadUrl, supabaseFileStorage } from "@/modules/documents/infrastructure/supabase-file-storage";
import { actionFailure } from "@/modules/shared/application/action-failure";
import { todayInBogota } from "@/modules/shared/domain/dates";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { isProofPath, isReceiptFilePath, proofFilePath, receiptFilePath } from "../domain/receipt-files";
import { normalizeReceiptNumber } from "../domain/receipt-number";
import { CoteroError } from "../domain/settlement-rules";
import type { FleetCandidates } from "../domain/fleet-matching";
import { coteroRepository, isFileReferenced, loadFleetCandidates, ReceiptsNotPending } from "../infrastructure/cotero-repository";
import { createCoteroCommands } from "./cotero-commands";
import {
  idSchema,
  numberListSchema,
  paySchema,
  pathListSchema,
  receiptBatchSchema,
  receiptDraftSchema,
  settlementSchema,
  tariffSchema,
  uploadRequestSchema,
} from "./cotero-schemas";

const commands = createCoteroCommands(coteroRepository, supabaseFileStorage);

const UNIQUE = {
  cotero_receipts_number_uq: "Ya existe un recibo con ese número.",
  cotero_tariffs_valid_from_uq: "Ya hay una tarifa que rige desde esa fecha.",
  cotero_settlements_number_uq: "Otra liquidación se creó al mismo tiempo. Intenta de nuevo.",
};

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function run(fn: (userId: string) => Promise<string>): Promise<ActionResult> {
  try {
    const session = await requireCoteroPayments();
    const message = await fn(session.user.id);
    expireAfterAction({ kind: "cotero-payments" });
    return { ok: true, message };
  } catch (e) {
    return actionFailure(e, { label: "cotero payments", expected: [CoteroError, ReceiptsNotPending], unique: UNIQUE });
  }
}

export type PrepareUploadsResult = { ok: true; uploads: Array<{ path: string; uploadUrl: string }> } | { ok: false; error: string };

/**
 * Signed URLs the browser uploads the original files to (receipt pages or payment proofs), directly to
 * storage: a scanned PDF does not fit in a server-action body.
 */
export async function prepareUploadsAction(requests: unknown): Promise<PrepareUploadsResult> {
  try {
    await requireCoteroPayments();
    const items = uploadRequestSchema.parse(requests);
    const today = todayInBogota();
    const uploads: Array<{ path: string; uploadUrl: string }> = [];
    for (const item of items) {
      if (!(ALLOWED_MIME as readonly string[]).includes(item.mimeType)) {
        throw new CoteroError("Solo se permiten archivos PDF, JPG, PNG o WebP.");
      }
      if (item.size <= 0) throw new CoteroError("El archivo está vacío.");
      if (item.size > MAX_FILE_BYTES) throw new CoteroError("El archivo supera el límite de 4 MB.");
      const make = item.kind === "receipt" ? receiptFilePath : proofFilePath;
      const path = make(today, randomUUID(), item.mimeType);
      uploads.push({ path, uploadUrl: await createSignedUploadUrl(path) });
    }
    return { ok: true, uploads };
  } catch (e) {
    const failure = actionFailure(e, { label: "cotero uploads", expected: [CoteroError] });
    return { ok: false, error: failure.error };
  }
}

export type FleetResult = { ok: true; fleet: FleetCandidates } | { ok: false; error: string };

/**
 * The active fleet, read fresh (never the cached copy): the review asks again after a driver is
 * registered in another tab, and the new one must show up right away.
 */
export async function refreshFleetAction(): Promise<FleetResult> {
  try {
    await requireCoteroPayments();
    return { ok: true, fleet: await loadFleetCandidates() };
  } catch (e) {
    const failure = actionFailure(e, { label: "cotero fleet", expected: [CoteroError] });
    return { ok: false, error: failure.error };
  }
}

export type CheckNumbersResult = { ok: true; existing: string[] } | { ok: false; error: string };

/** Which of the (normalized) receipt numbers are already stored: the review marks them as blocked. */
export async function checkReceiptNumbersAction(numbers: unknown): Promise<CheckNumbersResult> {
  try {
    await requireCoteroPayments();
    const normalized = numberListSchema
      .parse(numbers)
      .map(normalizeReceiptNumber)
      .filter((n): n is string => n !== null);
    return { ok: true, existing: await coteroRepository.findExistingNumbers([...new Set(normalized)]) };
  } catch (e) {
    const failure = actionFailure(e, { label: "cotero numbers", expected: [CoteroError] });
    return { ok: false, error: failure.error };
  }
}

export type CreateReceiptsResult = { ok: true; message: string; ids: number[] } | { ok: false; error: string };

/** Saves the reviewed batch: the server validates everything again; all the receipts or none. Returns the new ids. */
export async function createReceiptsAction(batch: unknown): Promise<CreateReceiptsResult> {
  let ids: number[] = [];
  const result = await run(async (userId) => {
    const created = await commands.createReceipts(userId, receiptBatchSchema.parse(batch));
    ids = created.ids;
    return created.count === 1 ? "Recibo guardado." : `${created.count} recibos guardados.`;
  });
  return result.ok ? { ...result, ids } : result;
}

/** Removes uploaded files whose review was cancelled, unless a receipt or a settlement already uses them. */
export async function discardUploadsAction(paths: unknown): Promise<void> {
  try {
    await requireCoteroPayments();
    const unused: string[] = [];
    for (const path of pathListSchema.parse(paths)) {
      if ((isReceiptFilePath(path) || isProofPath(path)) && !(await isFileReferenced(path))) unused.push(path);
    }
    if (unused.length > 0) await supabaseFileStorage.remove(unused);
  } catch (e) {
    if (!(e instanceof ForbiddenError)) console.error("cotero discard uploads failed", e);
  }
}

export async function updateReceiptAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await commands.updateReceipt(idSchema.parse(id), receiptDraftSchema.parse(formValues(fd)));
    return "Recibo actualizado.";
  });
}

export async function deleteReceiptAction(id: number): Promise<ActionResult> {
  return run(async () => {
    await commands.deleteReceipt(idSchema.parse(id));
    return "Recibo eliminado.";
  });
}

export async function createTariffAction(fd: FormData): Promise<ActionResult> {
  return run(async (userId) => {
    await commands.createTariff(userId, tariffSchema.parse(formValues(fd)));
    return "Tarifa agregada.";
  });
}

export type CreateSettlementResult = { ok: true; message: string; settlementId: number } | { ok: false; error: string };

/** Settles the chosen receipts. Returns the new settlement's id so its voucher can be printed right away. */
export async function createSettlementAction(input: unknown): Promise<CreateSettlementResult> {
  let settlementId = 0;
  const result = await run(async (userId) => {
    const created = await commands.createSettlement(userId, { ...settlementSchema.parse(input), today: todayInBogota() });
    settlementId = created.id;
    return `Liquidación ${created.number} creada y pagada.`;
  });
  return result.ok ? { ...result, settlementId } : result;
}

export async function annulSettlementAction(id: number): Promise<ActionResult> {
  return run(async () => {
    await commands.annulSettlement(idSchema.parse(id));
    return "Liquidación anulada: sus recibos vuelven a estar pendientes.";
  });
}

export async function deleteSettlementAction(id: number): Promise<ActionResult> {
  return run(async () => {
    await commands.deleteSettlement(idSchema.parse(id));
    return "Liquidación eliminada: sus recibos vuelven a estar pendientes.";
  });
}

export async function paySettlementAction(id: number, input: unknown): Promise<ActionResult> {
  return run(async () => {
    await commands.paySettlement(idSchema.parse(id), paySchema.parse(input));
    return "Pago registrado.";
  });
}
