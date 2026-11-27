/**
 * Commands of the daily cash box. Rules live in the domain; this layer talks to the ports, checks
 * that a box belongs to the user and is open, and turns a refusal into a `DailyCashError`.
 */
import { formatDisplayDate, type IsoDate } from "@/modules/shared/domain/dates";
import { assertBoxOpen, canCloseBox, DailyCashError, isFirstBox, previousBox, type BoxKey, type BoxStatus } from "../domain/box-rules";
import type { CashCount } from "../domain/cash-count";
import { classifyImport, type Classified, type Company, type ParsedVoucher } from "../domain/voucher-import";

export type EntryKind = "expense" | "income";
export type EntrySource = "import" | "manual";

export interface NewEntry {
  kind: EntryKind;
  company: Company | null;
  voucherNumber: string | null;
  detail: string;
  value: number;
  source: EntrySource;
}

export interface StoredBox {
  id: number;
  date: IsoDate;
  status: BoxStatus;
  openingBalance: number | null;
}

export interface ExpenseValues {
  company: Company;
  detail: string;
  value: number;
}

export interface IncomeValues {
  detail: string;
  value: number;
}

export interface DailyCashPorts {
  /** Every box of the user. */
  listBoxKeys(userId: string): Promise<BoxKey[]>;
  /** One box of the user; null when it does not exist or is someone else's. */
  findBox(userId: string, id: number): Promise<StoredBox | null>;
  insertBox(userId: string, values: { date: IsoDate; openingBalance: number | null }): Promise<{ id: number }>;
  setStatus(id: number, status: BoxStatus): Promise<void>;
  setOpeningBalance(id: number, value: number): Promise<void>;
  deleteBox(id: number): Promise<void>;
  /** One entry of a box of the user, with the status of that box. */
  findEntry(userId: string, id: number): Promise<{ id: number; boxId: number; kind: EntryKind; source: EntrySource; boxStatus: BoxStatus } | null>;
  /** All the rows or none. */
  insertEntries(boxId: number, rows: NewEntry[]): Promise<void>;
  updateEntry(id: number, values: { company: Company | null; detail: string; value: number }): Promise<void>;
  deleteEntry(id: number): Promise<void>;
  /** The `voucherKey`s among these vouchers that are already stored, in any box. */
  findStoredVoucherKeys(rows: ReadonlyArray<Pick<ParsedVoucher, "company" | "voucherNumber">>): Promise<Set<string>>;
  /** Replaces the whole arqueo of a box. */
  replaceCounts(boxId: number, counts: CashCount): Promise<void>;
}

const BOX_GONE = "La caja no existe.";
const ENTRY_GONE = "El movimiento ya no existe.";

export function createDailyCashCommands(ports: DailyCashPorts) {
  async function requireBox(userId: string, id: number): Promise<StoredBox> {
    const box = await ports.findBox(userId, id);
    if (!box) throw new DailyCashError(BOX_GONE);
    return box;
  }

  async function requireOpenBox(userId: string, id: number): Promise<StoredBox> {
    const box = await requireBox(userId, id);
    assertBoxOpen(box.status);
    return box;
  }

  async function requireEditableEntry(userId: string, id: number) {
    const entry = await ports.findEntry(userId, id);
    if (!entry) throw new DailyCashError(ENTRY_GONE);
    assertBoxOpen(entry.boxStatus);
    return entry;
  }

  /** Splits the vouchers into new ones and duplicates (stored in any box, or repeated). */
  async function previewImport<T extends ParsedVoucher>(rows: readonly T[]): Promise<Classified<T>> {
    return classifyImport(rows, await ports.findStoredVoucherKeys(rows));
  }

  return {
    previewImport,

    /** The opening balance is typed only when the new box would be the earliest of the user's. */
    async createBox(userId: string, input: { date: IsoDate; openingBalance: number | null }): Promise<{ id: number }> {
      const keys = await ports.listBoxKeys(userId);
      if (keys.some((b) => b.date === input.date)) throw new DailyCashError("Ya hay una caja para esa fecha.");
      const latestClosed = keys.filter((b) => b.status === "closed").reduce<IsoDate | null>((m, b) => (m === null || b.date > m ? b.date : m), null);
      if (latestClosed !== null && input.date < latestClosed) {
        throw new DailyCashError(`Hay una caja cerrada el ${formatDisplayDate(latestClosed)}: no se puede crear una caja con fecha anterior. Usa una fecha posterior o abre esa caja primero.`);
      }
      const first = isFirstBox(keys, input.date);
      if (first && input.openingBalance === null) {
        throw new DailyCashError("Escribe el saldo inicial: esta será la primera caja.");
      }
      return ports.insertBox(userId, { date: input.date, openingBalance: first ? input.openingBalance : null });
    },

    async setOpeningBalance(userId: string, boxId: number, value: number): Promise<void> {
      const box = await requireOpenBox(userId, boxId);
      const keys = await ports.listBoxKeys(userId);
      if (previousBox(keys, box.id) !== null) {
        throw new DailyCashError("El saldo inicial solo se escribe en la primera caja; las demás parten del arqueo anterior.");
      }
      await ports.setOpeningBalance(box.id, value);
    },

    async closeBox(userId: string, boxId: number): Promise<void> {
      const box = await requireBox(userId, boxId);
      if (box.status === "closed") return;
      const keys = await ports.listBoxKeys(userId);
      if (!canCloseBox(keys, box.id)) {
        const previous = previousBox(keys, box.id)!;
        throw new DailyCashError(`Cierra primero la caja del ${formatDisplayDate(previous.date)}.`);
      }
      await ports.setStatus(box.id, "closed");
    },

    async reopenBox(userId: string, boxId: number): Promise<void> {
      const box = await requireBox(userId, boxId);
      if (box.status === "open") return;
      await ports.setStatus(box.id, "open");
    },

    /** Only an open box: its imported vouchers become importable again. */
    async deleteBox(userId: string, boxId: number): Promise<void> {
      const box = await requireOpenBox(userId, boxId);
      const keys = await ports.listBoxKeys(userId);
      if (keys.some((b) => b.date > box.date)) {
        throw new DailyCashError("Solo se puede eliminar la última caja: elimina primero las cajas posteriores.");
      }
      await ports.deleteBox(box.id);
    },

    async addExpense(userId: string, boxId: number, values: ExpenseValues): Promise<void> {
      const box = await requireOpenBox(userId, boxId);
      await ports.insertEntries(box.id, [{ kind: "expense", company: values.company, voucherNumber: null, detail: values.detail, value: values.value, source: "manual" }]);
    },

    async addIncome(userId: string, boxId: number, values: IncomeValues): Promise<void> {
      const box = await requireOpenBox(userId, boxId);
      await ports.insertEntries(box.id, [{ kind: "income", company: null, voucherNumber: null, detail: values.detail, value: values.value, source: "manual" }]);
    },

    /** Manual entries only: an imported voucher is deleted and imported again instead. */
    async updateEntry(userId: string, entryId: number, values: { company: Company | null; detail: string; value: number }): Promise<void> {
      const entry = await requireEditableEntry(userId, entryId);
      if (entry.source === "import") {
        throw new DailyCashError("Un comprobante importado no se edita: elimínalo y vuelve a importarlo.");
      }
      if (entry.kind === "expense" && values.company === null) throw new DailyCashError("Elige la empresa del egreso.");
      await ports.updateEntry(entry.id, { company: entry.kind === "expense" ? values.company : null, detail: values.detail, value: values.value });
    },

    async deleteEntry(userId: string, entryId: number): Promise<void> {
      const entry = await requireEditableEntry(userId, entryId);
      await ports.deleteEntry(entry.id);
    },

    /** Saves the new vouchers of the upload into the open box; the duplicates are left out. */
    async confirmImport(userId: string, boxId: number, rows: readonly ParsedVoucher[]): Promise<{ imported: number; duplicates: number }> {
      const box = await requireOpenBox(userId, boxId);
      const { toImport, duplicates } = await previewImport(rows);
      if (toImport.length === 0) throw new DailyCashError("No hay comprobantes nuevos para importar.");
      await ports.insertEntries(
        box.id,
        toImport.map((r) => ({ kind: "expense", company: r.company, voucherNumber: r.voucherNumber, detail: r.detail, value: r.value, source: "import" as const })),
      );
      return { imported: toImport.length, duplicates: duplicates.length };
    },

    async saveCounts(userId: string, boxId: number, counts: CashCount): Promise<void> {
      const box = await requireOpenBox(userId, boxId);
      await ports.replaceCounts(box.id, counts);
    },
  };
}

export type DailyCashCommands = ReturnType<typeof createDailyCashCommands>;
