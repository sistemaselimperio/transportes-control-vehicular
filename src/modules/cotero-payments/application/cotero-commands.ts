/**
 * Commands of the cotero payments: receipts, tariffs and settlements. Rules live in the domain; this
 * layer validates what arrives, talks to the ports and turns a refusal into a `CoteroError`.
 */
import { normalizeDocument } from "../domain/cotero-identity";
import { describeFleetIssue, resolveFleetRefs, type FleetCandidates } from "../domain/fleet-matching";
import { MAX_PESOS } from "../domain/parse-values";
import {
  DRAFT_FIELD_LABELS,
  duplicateNumbers,
  parseDraft,
  type DraftIssue,
  type ReceiptDraft,
  type ReceiptValues,
} from "../domain/receipt-rules";
import {
  assertCanAnnul,
  assertCanEditReceipt,
  assertCanPay,
  assertCanSettle,
  CoteroError,
  settlementTotal,
  type PaymentMethod,
  type ReceiptStatus,
  type SettlementStatus,
} from "../domain/settlement-rules";
import { receiptFigures, type ReceiptFigures, type Tariff } from "../domain/tariff";
import type { PayInput, ReceiptBatchItem, SettlementInput, TariffInput } from "./cotero-schemas";

/** A receipt as the repository stores it: the normalized values, the tariff snapshot and the original file. */
export interface NewReceipt extends ReceiptValues, ReceiptFigures {
  filePath: string | null;
  pageNumber: number | null;
  /** The fleet entries the receipt names; the plate and driver text on it is their snapshot. */
  vehicleId: number;
  trailerId: number | null;
  driverId: number;
}

/** A receipt as a settlement needs to see it. */
export interface SettlementCandidate {
  id: number;
  status: ReceiptStatus;
  coteroKey: string;
  coteroName: string;
  coteroDocument: string | null;
  amount: number;
  date: string;
}

export interface NewSettlement {
  date: string;
  coteroKey: string;
  coteroName: string;
  coteroDocument: string | null;
  paymentMethod: PaymentMethod;
  paymentAccount: string | null;
  /** The payment is made with the settlement: it is stored already paid. */
  paidAt: string;
  proofPath: string | null;
  total: number;
  receiptIds: number[];
}

export interface CoteroProfileValues {
  key: string;
  name: string;
  document: string | null;
  paymentMethod: PaymentMethod | null;
  paymentAccount: string | null;
}

export interface CoteroPorts {
  listTariffs(): Promise<Tariff[]>;
  /** The active fleet (not sold vehicles, not inactive drivers) a receipt may name. */
  loadFleet(): Promise<FleetCandidates>;
  /** Which of `numbers` are already stored, ignoring receipt `exceptId`. */
  findExistingNumbers(numbers: string[], exceptId?: number): Promise<string[]>;
  /** All or nothing. Returns the new ids, in the order of `rows`. */
  insertReceipts(userId: string, rows: NewReceipt[]): Promise<number[]>;
  findReceipt(id: number): Promise<{ id: number; status: ReceiptStatus; filePath: string | null; pageNumber: number | null; settlementId: number | null } | null>;
  updateReceipt(id: number, row: NewReceipt): Promise<void>;
  /**
   * In one transaction deletes the receipt in any status. When it belonged to a settlement, that settlement's
   * total is recalculated from the receipts left, or the settlement is deleted with its last receipt (and
   * `removedProofPath` is its proof file). Null (nothing changed) when the receipt was already gone.
   */
  deleteReceipt(id: number): Promise<{ removedProofPath: string | null } | null>;
  countReceiptsWithFile(path: string): Promise<number>;
  insertTariff(userId: string, tariff: TariffInput): Promise<void>;
  findReceiptsForSettlement(ids: number[]): Promise<SettlementCandidate[]>;
  upsertProfile(profile: CoteroProfileValues): Promise<void>;
  /**
   * In one transaction: takes the next number, stores the settlement already paid and marks its receipts paid.
   * Null (nothing stored) when one of them stopped being pending meanwhile.
   */
  createSettlement(userId: string, settlement: NewSettlement): Promise<{ id: number; number: number } | null>;
  findSettlement(id: number): Promise<{ id: number; status: SettlementStatus } | null>;
  /** Open or paid to annulled, receipts back to pending. False (nothing changed) when it was already annulled. */
  annulSettlement(id: number): Promise<boolean>;
  /**
   * In one transaction deletes the settlement in any status and sends its receipts back to pending.
   * Returns its proof file path, or null (nothing changed) when it was already gone.
   */
  deleteSettlement(id: number): Promise<{ proofPath: string | null } | null>;
  countSettlementsWithProof(path: string): Promise<number>;
  /** Legacy: settlements created before payment moved into the settle step may still be open. Open to paid, receipts to paid. False when it was not open. */
  paySettlement(id: number, payment: PayInput): Promise<boolean>;
}

export interface CoteroStorage {
  remove(paths: string[]): Promise<void>;
}

const RECEIPT_GONE = "El recibo ya no existe.";
const SETTLEMENT_GONE = "La liquidación no existe.";
const SETTLEMENT_CHANGED = "La liquidación cambió mientras la mirabas: recarga e intenta de nuevo.";

const describeIssue = ({ field, kind }: DraftIssue) =>
  kind === "missing" ? `falta ${DRAFT_FIELD_LABELS[field]}` : `${DRAFT_FIELD_LABELS[field]} no es válido`;

export const alreadyRegistered = (number: string) => `El recibo ${number} ya está registrado.`;
const repeatedInBatch = (number: string) => `El recibo ${number} está repetido en la lista.`;

export function createCoteroCommands(ports: CoteroPorts, storage: CoteroStorage) {
  /** The draft as values, or the refusal that says which field to fix. `label` prefixes the message. */
  function parseOrThrow(draft: ReceiptDraft, label: string): ReceiptValues {
    const { values, issues } = parseDraft(draft);
    if (!values) throw new CoteroError(`${label}: ${issues.map(describeIssue).join(", ")}.`);
    return values;
  }

  /**
   * The values with the plates and the driver checked against the active fleet: only an exact entry is
   * accepted (the screens correct near misses, the server never guesses). Their text becomes the snapshot.
   */
  function withFleet(values: ReceiptValues, fleet: FleetCandidates, label: string): ReceiptValues & Pick<NewReceipt, "vehicleId" | "trailerId" | "driverId"> {
    const resolved = resolveFleetRefs({ ...values, trailerPlate: values.trailerPlate ?? "" }, fleet);
    if (!resolved.ok) throw new CoteroError(`${label}: ${resolved.issues.map(describeFleetIssue).join(", ")}.`);
    const { refs } = resolved;
    return {
      ...values,
      vehiclePlate: refs.vehiclePlate,
      trailerPlate: refs.trailerPlate,
      driverName: refs.driverName,
      vehicleId: refs.vehicleId,
      trailerId: refs.trailerId,
      driverId: refs.driverId,
    };
  }

  const toNewReceipt = (
    values: ReceiptValues & Pick<NewReceipt, "vehicleId" | "trailerId" | "driverId">,
    tariffs: readonly Tariff[],
    file: { filePath: string | null; pageNumber: number | null },
  ): NewReceipt => ({
    ...values,
    ...receiptFigures(values, tariffs),
    ...file,
  });

  /** Removes a settlement's proof file once no settlement points at it; a storage failure never undoes the deletion. */
  async function removeUnreferencedProof(path: string | null): Promise<void> {
    if (path && (await ports.countSettlementsWithProof(path)) === 0) {
      await storage.remove([path]).catch((err) => console.error("cotero proof file removal failed", err));
    }
  }

  return {
    /** Validates the whole batch first; stores all of it or none. Returns how many were stored and their ids. */
    async createReceipts(userId: string, items: readonly ReceiptBatchItem[]): Promise<{ count: number; ids: number[] }> {
      const parsed = items.map((item, i) => parseOrThrow(item, `Recibo ${i + 1}`));
      const fleet = await ports.loadFleet();
      const valuesList = parsed.map((values, i) => withFleet(values, fleet, `Recibo ${i + 1}`));
      const numbers = valuesList.map((v) => v.receiptNumber);
      const [repeated] = duplicateNumbers(numbers);
      if (repeated !== undefined) throw new CoteroError(repeatedInBatch(repeated));
      const [existing] = await ports.findExistingNumbers(numbers);
      if (existing !== undefined) throw new CoteroError(alreadyRegistered(existing));

      const tariffs = await ports.listTariffs();
      const ids = await ports.insertReceipts(
        userId,
        valuesList.map((values, i) => toNewReceipt(values, tariffs, { filePath: items[i].filePath, pageNumber: items[i].pageNumber })),
      );
      return { count: items.length, ids };
    },

    /** Only a pending receipt; its file and page stay. The tariff snapshot is taken again for its (new) date. */
    async updateReceipt(id: number, draft: ReceiptDraft): Promise<void> {
      const current = await ports.findReceipt(id);
      if (!current) throw new CoteroError(RECEIPT_GONE);
      assertCanEditReceipt(current.status);
      const values = withFleet(parseOrThrow(draft, "Recibo"), await ports.loadFleet(), "Recibo");
      const [existing] = await ports.findExistingNumbers([values.receiptNumber], id);
      if (existing !== undefined) throw new CoteroError(alreadyRegistered(existing));
      const row = toNewReceipt(values, await ports.listTariffs(), { filePath: current.filePath, pageNumber: current.pageNumber });
      await ports.updateReceipt(id, row);
    },

    /**
     * Any status. A receipt of a settlement leaves it (see `CoteroPorts.deleteReceipt`). Its file goes too,
     * unless another receipt of the same page still shows it; so does the proof of a settlement deleted with it.
     */
    async deleteReceipt(id: number): Promise<void> {
      const current = await ports.findReceipt(id);
      if (!current) throw new CoteroError(RECEIPT_GONE);
      const deleted = await ports.deleteReceipt(id);
      if (!deleted) throw new CoteroError(RECEIPT_GONE);
      if (current.filePath && (await ports.countReceiptsWithFile(current.filePath)) === 0) {
        await storage.remove([current.filePath]).catch((err) => console.error("cotero receipt file removal failed", err));
      }
      await removeUnreferencedProof(deleted.removedProofPath);
    },

    async createTariff(userId: string, tariff: TariffInput): Promise<void> {
      await ports.insertTariff(userId, tariff);
    },

    /** Settles and pays the chosen pending receipts of one cotero; remembers the cotero's cédula and payment details. */
    async createSettlement(userId: string, input: SettlementInput & { today: string }): Promise<{ id: number; number: number }> {
      const receipts = await ports.findReceiptsForSettlement(input.receiptIds);
      if (receipts.length !== input.receiptIds.length) throw new CoteroError(RECEIPT_GONE);
      assertCanSettle(receipts.map((r) => r.status));
      if (receipts.some((r) => r.coteroKey !== input.coteroKey)) {
        throw new CoteroError("Los recibos son de distintos coteros.");
      }
      const typed = input.document.trim();
      const typedDocument = normalizeDocument(typed);
      if (typed !== "" && typedDocument === null) throw new CoteroError("La cédula o el NIT no es válido.");

      const newestFirst = [...receipts].sort((a, b) => b.date.localeCompare(a.date));
      const name = newestFirst[0].coteroName;
      const document = typedDocument ?? newestFirst.find((r) => r.coteroDocument !== null)?.coteroDocument ?? null;
      const total = settlementTotal(receipts.map((r) => r.amount));
      if (total > MAX_PESOS) throw new CoteroError("El total de la liquidación es demasiado grande.");
      // A cédula typed now is remembered in the profile, but the receipts keep the key they were saved under.
      const key = input.coteroKey;

      await ports.upsertProfile({ key, name, document, paymentMethod: input.paymentMethod, paymentAccount: input.paymentAccount });
      const created = await ports.createSettlement(userId, {
        date: input.today,
        coteroKey: key,
        coteroName: name,
        coteroDocument: document,
        paymentMethod: input.paymentMethod,
        paymentAccount: input.paymentAccount,
        paidAt: input.paidAt,
        proofPath: input.proofPath,
        total,
        receiptIds: receipts.map((r) => r.id),
      });
      if (!created) throw new CoteroError("Algún recibo ya no está pendiente: recarga e intenta de nuevo.");
      return created;
    },

    /** Open or paid; its receipts go back to pending. */
    async annulSettlement(id: number): Promise<void> {
      const settlement = await ports.findSettlement(id);
      if (!settlement) throw new CoteroError(SETTLEMENT_GONE);
      assertCanAnnul(settlement.status);
      if (!(await ports.annulSettlement(id))) throw new CoteroError(SETTLEMENT_CHANGED);
    },

    /** Any status: its receipts go back to pending and its proof file is removed. */
    async deleteSettlement(id: number): Promise<void> {
      if (!(await ports.findSettlement(id))) throw new CoteroError(SETTLEMENT_GONE);
      const deleted = await ports.deleteSettlement(id);
      if (!deleted) throw new CoteroError(SETTLEMENT_CHANGED);
      await removeUnreferencedProof(deleted.proofPath);
    },

    async paySettlement(id: number, payment: PayInput): Promise<void> {
      const settlement = await ports.findSettlement(id);
      if (!settlement) throw new CoteroError(SETTLEMENT_GONE);
      assertCanPay(settlement.status);
      if (!(await ports.paySettlement(id, payment))) throw new CoteroError(SETTLEMENT_CHANGED);
    },
  };
}

export type CoteroCommands = ReturnType<typeof createCoteroCommands>;
