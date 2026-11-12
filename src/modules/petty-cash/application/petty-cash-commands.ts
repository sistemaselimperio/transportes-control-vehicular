/**
 * Command use cases of the petty-cash ledgers. Every one is scoped to the owning user: a ledger or
 * expense of another user is reported as missing, never touched.
 */
import { randomUUID } from "node:crypto";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/modules/documents/domain/vehicle-file-rules";
import type { VehicleFileStorage } from "@/modules/documents/application/vehicle-file-ports";
import type { IsoDate } from "@/modules/shared/domain/dates";
import type { ResponsibilityType } from "../domain/expense";
import { isPossibleDuplicate } from "../domain/invoice";
import { wouldBeFirst } from "../domain/ledger-balances";
import type { ExpenseInput, LedgerInput } from "./petty-cash-schemas";
import { resolveOwner, resolveVehicle } from "./expense-resolvers";

/** A rule refused the operation; the message is for the user. */
export class PettyCashError extends Error {}

/** The unique (user, number) index refused a ledger: another one took that number first. */
export class LedgerNumberTakenError extends Error {
  constructor() {
    super("El número de planilla ya está en uso.");
  }
}

/** Tries to take the next number before giving up; each loss means a concurrent create won it. */
const MAX_NUMBER_ATTEMPTS = 5;

/** Object storage for the attachments; paths are `<userId>/<uuid>`. */
export type PettyCashStorage = VehicleFileStorage;

export interface AttachmentUpload {
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export interface StoredAttachment {
  path: string;
  name: string;
  mimeType: string;
}

export interface ExpenseValues {
  detail: string;
  invoiceNumber: string | null;
  efk: string | null;
  /** The issuing supplier's NIT, digits only. */
  nit: string | null;
  supplierName: string | null;
  /** The party the invoice is billed to; `ownerId` links it when it is a known owner. */
  company: string | null;
  ownerId: number | null;
  responsibilityType: ResponsibilityType | null;
  vehicleId: number | null;
  vehicleLabel: string | null;
  value: number | null;
  needsReview: boolean;
  possibleDuplicate: boolean;
}

export interface SupplierEntry {
  nit: string;
  supplierName: string | null;
  responsibilityType: ResponsibilityType | null;
}

export interface PettyCashPorts {
  /** Date, id and permanent number of every ledger of the user. */
  listLedgerKeys(userId: string): Promise<Array<{ id: number; date: IsoDate; number: number }>>;
  setInitialBalance(userId: string, amount: number): Promise<void>;
  /** Throws `LedgerNumberTakenError` when the user already has a ledger with this number. */
  insertLedger(userId: string, values: { date: IsoDate; compenseAmount: number; number: number }): Promise<{ id: number }>;
  /** False when the user has no such ledger. */
  updateLedger(userId: string, id: number, values: { date: IsoDate; compenseAmount: number }): Promise<boolean>;
  findLedger(userId: string, id: number): Promise<{ id: number; date: IsoDate } | null>;
  /** Deletes the ledger with its expenses; returns their attachment paths, or null when the user has no such ledger. */
  deleteLedger(userId: string, id: number): Promise<string[] | null>;
  findVehicleByPlate(plate: string): Promise<{ id: number; plate: string } | null>;
  /** Every owner an invoice can be billed to. */
  listOwners(): Promise<Array<{ id: number; name: string }>>;
  /** Every fleet vehicle, for the AI to match plates against. */
  listFleet(): Promise<Array<{ id: number; plate: string }>>;
  listSuppliers(): Promise<SupplierEntry[]>;
  /** Invoice numbers of the user's expenses with this supplier NIT, leaving out `excludeExpenseId`. */
  listInvoiceNumbers(userId: string, nit: string, excludeExpenseId?: number): Promise<Array<string | null>>;
  insertExpense(ledgerId: number, values: ExpenseValues & { attachment: StoredAttachment | null }): Promise<void>;
  /** An expense of one of the user's ledgers. */
  findExpense(userId: string, id: number): Promise<{ id: number; ledgerId: number; attachmentPath: string | null } | null>;
  /** `attachment`: undefined keeps the current one, null removes it. False when the expense is gone. */
  updateExpense(id: number, values: ExpenseValues & { attachment?: StoredAttachment | null }): Promise<boolean>;
  deleteExpense(id: number): Promise<boolean>;
  /** A blank name or responsibility must not erase the one already known for this NIT. */
  upsertSupplier(supplier: SupplierEntry): Promise<void>;
}

const NO_LEDGER = "La planilla no existe.";
const NO_EXPENSE = "El gasto no existe.";

function assertCanAttach(file: AttachmentUpload) {
  if (!(ALLOWED_MIME as readonly string[]).includes(file.mimeType)) {
    throw new PettyCashError("Solo se permiten archivos PDF, JPG, PNG o WebP.");
  }
  if (file.data.length === 0) throw new PettyCashError("El archivo está vacío.");
  if (file.data.length > MAX_FILE_BYTES) throw new PettyCashError("El archivo supera el límite de 4 MB.");
}

export function createPettyCashCommands(ports: PettyCashPorts, storage: PettyCashStorage) {
  /** A typed company must be one of the existing ones; empty is allowed (the expense stays pending). */
  async function ownerOf(company: string | null) {
    if (!company?.trim()) return { ownerId: null, company: null };
    const owner = resolveOwner(company, await ports.listOwners());
    if (owner.ownerId === null) throw new PettyCashError("Elige una empresa de la lista.");
    return owner;
  }

  /** Manual entry is always complete and reviewed; a duplicate is flagged, never refused. */
  async function toValues(userId: string, input: ExpenseInput, excludeExpenseId?: number): Promise<ExpenseValues> {
    const sameNit = await ports.listInvoiceNumbers(userId, input.nit, excludeExpenseId);
    return {
      detail: input.detail,
      invoiceNumber: input.invoiceNumber,
      efk: input.efk,
      nit: input.nit,
      supplierName: input.supplierName,
      responsibilityType: input.responsibilityType,
      value: input.value,
      needsReview: false,
      possibleDuplicate: isPossibleDuplicate(input.nit, input.invoiceNumber, sameNit),
      ...(await ownerOf(input.company)),
      ...(await resolveVehicle(ports, input.vehicle)),
    };
  }

  async function store(userId: string, file: AttachmentUpload): Promise<StoredAttachment> {
    assertCanAttach(file);
    const path = `${userId}/${randomUUID()}`;
    await storage.put(path, file.data, file.mimeType);
    return { path, name: file.fileName, mimeType: file.mimeType };
  }

  const discard = (paths: string[]) =>
    paths.length === 0
      ? Promise.resolve()
      : storage.remove(paths).catch((err) => console.error("petty cash attachment removal failed", err));

  async function rememberSupplier(input: ExpenseInput) {
    if (input.supplierName || input.responsibilityType) {
      await ports.upsertSupplier({ nit: input.nit, supplierName: input.supplierName, responsibilityType: input.responsibilityType });
    }
  }

  /**
   * Numbers are permanent: the next one is the highest ever taken plus one (deleting never frees
   * one, a backdated ledger still gets the next). Two creates racing for the same number collide on
   * the unique index; the loser re-reads and tries again.
   */
  async function insertNumbered(userId: string, input: LedgerInput, existing: Array<{ number: number }>) {
    let keys = existing;
    for (let attempt = 1; ; attempt++) {
      const number = keys.reduce((max, k) => Math.max(max, k.number), 0) + 1;
      try {
        const { id } = await ports.insertLedger(userId, { date: input.date, compenseAmount: input.compenseAmount, number });
        return { id, number };
      } catch (e) {
        if (!(e instanceof LedgerNumberTakenError) || attempt >= MAX_NUMBER_ATTEMPTS) throw e;
        keys = await ports.listLedgerKeys(userId);
      }
    }
  }

  return {
    async createLedger(userId: string, input: LedgerInput) {
      const existing = await ports.listLedgerKeys(userId);
      // The opening balance is typed for the earliest ledger only: the very first one, or a new one
      // dated before all the others (it then becomes the start of the chain).
      if (wouldBeFirst(existing, { id: null, date: input.date })) {
        await ports.setInitialBalance(userId, input.openingBalance ?? 0);
      }
      return insertNumbered(userId, input, existing);
    },

    async updateLedger(userId: string, id: number, input: LedgerInput) {
      if (!(await ports.findLedger(userId, id))) throw new PettyCashError(NO_LEDGER);
      if (!(await ports.updateLedger(userId, id, { date: input.date, compenseAmount: input.compenseAmount }))) {
        throw new PettyCashError(NO_LEDGER);
      }
      if (input.openingBalance !== null) {
        // Re-read after the change: moving the date can change which ledger comes first.
        const keys = await ports.listLedgerKeys(userId);
        const others = keys.filter((k) => k.id !== id);
        if (wouldBeFirst(others, { id, date: input.date })) await ports.setInitialBalance(userId, input.openingBalance);
      }
    },

    async deleteLedger(userId: string, id: number) {
      const paths = await ports.deleteLedger(userId, id);
      if (paths === null) throw new PettyCashError(NO_LEDGER);
      // The rows are gone; a failed removal only leaves orphan objects, so it never fails the delete.
      await discard(paths);
    },

    async addExpense(userId: string, ledgerId: number, input: ExpenseInput, file: AttachmentUpload | null) {
      if (!(await ports.findLedger(userId, ledgerId))) throw new PettyCashError(NO_LEDGER);
      const values = await toValues(userId, input);
      // Bytes first: a row must never point at an object that does not exist.
      const attachment = file ? await store(userId, file) : null;
      try {
        await ports.insertExpense(ledgerId, { ...values, attachment });
      } catch (e) {
        if (attachment) await discard([attachment.path]);
        throw e;
      }
      await rememberSupplier(input);
    },

    /** Saving through the edit form (also the review form) is the review: it clears the flag. */
    async updateExpense(
      userId: string,
      id: number,
      input: ExpenseInput,
      change: { upload: AttachmentUpload | null; remove: boolean },
    ) {
      const current = await ports.findExpense(userId, id);
      if (!current) throw new PettyCashError(NO_EXPENSE);
      const values = await toValues(userId, input, id);
      const attachment = change.upload ? await store(userId, change.upload) : change.remove ? null : undefined;
      let updated: boolean;
      try {
        updated = await ports.updateExpense(id, attachment === undefined ? values : { ...values, attachment });
      } catch (e) {
        if (attachment) await discard([attachment.path]);
        throw e;
      }
      if (!updated) {
        if (attachment) await discard([attachment.path]);
        throw new PettyCashError(NO_EXPENSE);
      }
      if (attachment !== undefined && current.attachmentPath) await discard([current.attachmentPath]);
      await rememberSupplier(input);
    },

    async deleteExpense(userId: string, id: number) {
      const current = await ports.findExpense(userId, id);
      if (!current) throw new PettyCashError(NO_EXPENSE);
      if (!(await ports.deleteExpense(id))) throw new PettyCashError(NO_EXPENSE);
      if (current.attachmentPath) await discard([current.attachmentPath]);
    },
  };
}

export type PettyCashCommands = ReturnType<typeof createPettyCashCommands>;
