"use server";

/**
 * Server actions of the petty-cash ledgers. Each one re-checks that the session user has petty-cash
 * access, parses the form with zod and runs a command scoped to that user.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { ForbiddenError } from "@/lib/permissions";
import { requirePettyCash } from "@/lib/session";
import { createSignedUploadUrl, supabaseFileStorage } from "@/modules/documents/infrastructure/supabase-file-storage";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { importMessage } from "../domain/import-message";
import { ledgerSlug } from "../domain/ledger-slug";
import { openAiInvoiceExtractor } from "../infrastructure/openai-invoice-extractor";
import { pdfLibPages } from "../infrastructure/pdf-lib-pages";
import { pettyCashRepository } from "../infrastructure/petty-cash-repository";
import { createInvoiceImport } from "./invoice-import";
import { createPettyCashCommands, PettyCashError, type AttachmentUpload } from "./petty-cash-commands";
import { expenseIdSchema, expenseSchema, ledgerIdSchema, ledgerSchema } from "./petty-cash-schemas";

const commands = createPettyCashCommands(pettyCashRepository, supabaseFileStorage);
const invoiceImport = createInvoiceImport(
  pettyCashRepository,
  { ...supabaseFileStorage, createUploadUrl: createSignedUploadUrl },
  openAiInvoiceExtractor,
  pdfLibPages,
);

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function run(fn: (userId: string) => Promise<string>): Promise<ActionResult> {
  try {
    const session = await requirePettyCash();
    const message = await fn(session.user.id);
    // The reads are per user and uncached: refresh the screens that show them.
    revalidatePath("/caja", "layout");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof PettyCashError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos ingresados." };
    }
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    if (e instanceof Error && e.message === "No autorizado") {
      return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }
    console.error("petty cash action failed", e);
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }
}

/** The optional attachment of the expense form: an empty file input arrives as a zero-byte file. */
async function readUpload(fd: FormData): Promise<AttachmentUpload | null> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return { fileName: file.name, mimeType: file.type, data: Buffer.from(await file.arrayBuffer()) };
}

export async function createLedgerAction(fd: FormData): Promise<ActionResult> {
  let createdNumber: number | undefined;
  const result = await run(async (userId) => {
    createdNumber = (await commands.createLedger(userId, ledgerSchema.parse(formValues(fd)))).number;
    return "Planilla creada.";
  });
  // Open the new ledger so the expenses can be added right away; redirect must run outside try/catch.
  if (result.ok && createdNumber !== undefined) redirect(`/caja/${ledgerSlug(createdNumber)}`);
  return result;
}

export async function updateLedgerAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async (userId) => {
    await commands.updateLedger(userId, ledgerIdSchema.parse(id), ledgerSchema.parse(formValues(fd)));
    return "Planilla actualizada.";
  });
}

export async function deleteLedgerAction(id: number): Promise<ActionResult> {
  return run(async (userId) => {
    await commands.deleteLedger(userId, ledgerIdSchema.parse(id));
    return "Planilla eliminada.";
  });
}

export async function createExpenseAction(ledgerId: number, fd: FormData): Promise<ActionResult> {
  return run(async (userId) => {
    const input = expenseSchema.parse(formValues(fd));
    await commands.addExpense(userId, ledgerIdSchema.parse(ledgerId), input, await readUpload(fd));
    return "Gasto registrado.";
  });
}

export async function updateExpenseAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async (userId) => {
    const input = expenseSchema.parse(formValues(fd));
    await commands.updateExpense(userId, expenseIdSchema.parse(id), input, {
      upload: await readUpload(fd),
      remove: fd.get("removeAttachment") === "on",
    });
    return "Gasto actualizado.";
  });
}

export async function deleteExpenseAction(id: number): Promise<ActionResult> {
  return run(async (userId) => {
    await commands.deleteExpense(userId, expenseIdSchema.parse(id));
    return "Gasto eliminado.";
  });
}

export type PrepareImportResult = { ok: true; path: string; uploadUrl: string } | { ok: false; error: string };

/** Step 1 of an import from a photo or PDF: a signed URL the browser uploads the file to. */
export async function prepareImportUploadAction(): Promise<PrepareImportResult> {
  try {
    const session = await requirePettyCash();
    return { ok: true, ...(await invoiceImport.prepareUpload(session.user.id)) };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    console.error("petty cash import upload failed", e);
    return { ok: false, error: "No se pudo preparar la carga del archivo. Intenta de nuevo." };
  }
}

/** Step 2: reads the uploaded file with the AI and adds its invoices to the ledger, ready to review. */
export async function importExpensesAction(ledgerId: number, path: string, fileName: string): Promise<ActionResult> {
  return run(async (userId) => {
    const summary = await invoiceImport.importExpenses(userId, ledgerIdSchema.parse(ledgerId), {
      path: z.string().min(1).max(300).parse(path),
      fileName: z.string().max(200).parse(fileName),
    });
    return importMessage(summary);
  });
}
