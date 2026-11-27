import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CoteroPorts, NewReceipt } from "../application/cotero-commands";
import { toFleetCandidates, type FleetCandidates } from "../domain/fleet-matching";
import type { ReceiptRow } from "../domain/receipt-rules";
import type { CoteroProfileRow, SettlementRow, TariffRow } from "../domain/settlement-rows";
import { isPaymentMethod, type PaymentMethod } from "../domain/settlement-rules";

const {
  coteroReceipts: receipts,
  coteroSettlements: settlements,
  coteroTariffs: tariffs,
  coteroProfiles: profiles,
  vehicles,
  vehicleClasses,
  drivers,
} = schema;

const asMethod = (value: string | null): PaymentMethod | null => (value !== null && isPaymentMethod(value) ? value : null);

/** Every receipt, newest day first, with the number of the settlement that holds it. */
export async function loadReceiptRows(): Promise<ReceiptRow[]> {
  const rows = await db
    .select({ receipt: receipts, settlementNumber: settlements.number })
    .from(receipts)
    .leftJoin(settlements, eq(settlements.id, receipts.settlementId))
    .orderBy(desc(receipts.date), desc(receipts.id));
  return rows.map(({ receipt: r, settlementNumber }) => ({
    id: r.id,
    receiptNumber: r.receiptNumber,
    date: r.date,
    destination: r.destination,
    remissions: r.remissions,
    tons: r.tons,
    vehiclePlate: r.vehiclePlate,
    trailerPlate: r.trailerPlate,
    coteroKey: r.coteroKey,
    coteroName: r.coteroName,
    coteroDocument: r.coteroDocument,
    driverName: r.driverName,
    amount: r.amount,
    tariffPerTon: r.tariffPerTon,
    expectedAmount: r.expectedAmount,
    amountMismatch: r.amountMismatch,
    filePath: r.filePath,
    pageNumber: r.pageNumber,
    status: r.status,
    settlementId: r.settlementId,
    settlementNumber,
  }));
}

/** Every settlement, newest first. */
export async function loadSettlementRows(): Promise<SettlementRow[]> {
  const counts = db
    .select({ settlementId: receipts.settlementId, receiptCount: count().as("receipt_count") })
    .from(receipts)
    .groupBy(receipts.settlementId)
    .as("counts");
  const rows = await db
    .select({ settlement: settlements, receiptCount: counts.receiptCount })
    .from(settlements)
    .leftJoin(counts, eq(counts.settlementId, settlements.id))
    .orderBy(desc(settlements.number));
  return rows.map(({ settlement: s, receiptCount }) => ({
    id: s.id,
    number: s.number,
    date: s.date,
    coteroKey: s.coteroKey,
    coteroName: s.coteroName,
    coteroDocument: s.coteroDocument,
    paymentMethod: asMethod(s.paymentMethod),
    paymentAccount: s.paymentAccount,
    total: s.total,
    status: s.status,
    paidAt: s.paidAt,
    hasProof: s.proofPath !== null,
    receiptCount: Number(receiptCount ?? 0),
  }));
}

/** Every tariff, latest start first. */
export async function loadTariffRows(): Promise<TariffRow[]> {
  return db
    .select({ id: tariffs.id, validFrom: tariffs.validFrom, pricePerTon: tariffs.pricePerTon })
    .from(tariffs)
    .orderBy(desc(tariffs.validFrom));
}

export async function loadProfileRows(): Promise<CoteroProfileRow[]> {
  const rows = await db.select().from(profiles).orderBy(asc(profiles.name));
  return rows.map((p) => ({ key: p.key, name: p.name, document: p.document, paymentMethod: asMethod(p.paymentMethod), paymentAccount: p.paymentAccount }));
}

/** The storage path of a receipt's original file, for the route that serves it. */
export async function findReceiptFilePath(id: number): Promise<string | null> {
  const [row] = await db.select({ filePath: receipts.filePath }).from(receipts).where(eq(receipts.id, id)).limit(1);
  return row?.filePath ?? null;
}

/** The storage path of a settlement's proof of payment. */
export async function findSettlementProofPath(id: number): Promise<string | null> {
  const [row] = await db.select({ proofPath: settlements.proofPath }).from(settlements).where(eq(settlements.id, id)).limit(1);
  return row?.proofPath ?? null;
}

/** One settlement with the receipts it holds, for its Excel sheet; null when it does not exist. */
export async function loadSettlementWithReceipts(id: number): Promise<{ settlement: SettlementRow; receipts: ReceiptRow[] } | null> {
  const [settlement] = (await loadSettlementRows()).filter((s) => s.id === id);
  if (!settlement) return null;
  const all = await loadReceiptRows();
  return { settlement, receipts: all.filter((r) => r.settlementId === id).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id) };
}

/** Whether a receipt or a settlement still points at this stored file. */
export async function isFileReferenced(path: string): Promise<boolean> {
  const [receipt] = await db.select({ id: receipts.id }).from(receipts).where(eq(receipts.filePath, path)).limit(1);
  if (receipt) return true;
  const [settlement] = await db.select({ id: settlements.id }).from(settlements).where(eq(settlements.proofPath, path)).limit(1);
  return settlement !== undefined;
}

/** A receipt stopped being pending while it was being edited, deleted or settled; aborts the transaction when inside one. */
class ReceiptsNotPending extends Error {
  constructor() {
    super("El recibo cambió mientras lo editabas: recarga e intenta de nuevo.");
  }
}

/**
 * The vehicles and drivers a receipt may name (not sold, not inactive; see `toFleetCandidates`). Reads
 * only what matching needs, so it works for anyone with the cotero flag, whatever their fleet access.
 */
export async function loadFleetCandidates(): Promise<FleetCandidates> {
  const [vehicleRows, driverRows] = await Promise.all([
    db
      .select({ id: vehicles.id, plate: vehicles.plate, status: vehicles.status, className: vehicleClasses.name })
      .from(vehicles)
      .innerJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.classId)),
    db.select({ id: drivers.id, name: drivers.name, status: drivers.status }).from(drivers),
  ]);
  return toFleetCandidates(vehicleRows, driverRows);
}

const toColumns = (r: NewReceipt) => ({
  receiptNumber: r.receiptNumber,
  date: r.date,
  destination: r.destination,
  remissions: r.remissions,
  tons: r.tons,
  vehiclePlate: r.vehiclePlate,
  trailerPlate: r.trailerPlate,
  coteroKey: r.coteroKey,
  coteroName: r.coteroName,
  coteroDocument: r.coteroDocument,
  driverName: r.driverName,
  vehicleId: r.vehicleId,
  trailerId: r.trailerId,
  driverId: r.driverId,
  amount: r.amount,
  tariffPerTon: r.tariffPerTon,
  expectedAmount: r.expectedAmount,
  amountMismatch: r.amountMismatch,
});

export const coteroRepository: CoteroPorts = {
  loadFleet: loadFleetCandidates,

  async listTariffs() {
    return db.select({ validFrom: tariffs.validFrom, pricePerTon: tariffs.pricePerTon }).from(tariffs);
  },

  async findExistingNumbers(numbers, exceptId) {
    if (numbers.length === 0) return [];
    const rows = await db
      .select({ receiptNumber: receipts.receiptNumber })
      .from(receipts)
      .where(and(inArray(receipts.receiptNumber, numbers), exceptId === undefined ? undefined : ne(receipts.id, exceptId)));
    return rows.map((r) => r.receiptNumber);
  },

  async insertReceipts(userId, rows) {
    // One statement: all the receipts or none.
    const created = await db
      .insert(receipts)
      .values(rows.map((r) => ({ ...toColumns(r), filePath: r.filePath, pageNumber: r.pageNumber, createdBy: userId })))
      .returning({ id: receipts.id });
    return created.map((r) => r.id);
  },

  async findReceipt(id) {
    const [row] = await db
      .select({ id: receipts.id, status: receipts.status, filePath: receipts.filePath, pageNumber: receipts.pageNumber })
      .from(receipts)
      .where(eq(receipts.id, id))
      .limit(1);
    return row ?? null;
  },

  async updateReceipt(id, row) {
    // Only while pending: a settlement made meanwhile must not be edited under it.
    const updated = await db
      .update(receipts)
      .set({ ...toColumns(row), updatedAt: new Date() })
      .where(and(eq(receipts.id, id), eq(receipts.status, "pending")))
      .returning({ id: receipts.id });
    if (updated.length === 0) throw new ReceiptsNotPending();
  },

  async deleteReceipt(id) {
    const deleted = await db
      .delete(receipts)
      .where(and(eq(receipts.id, id), eq(receipts.status, "pending")))
      .returning({ id: receipts.id });
    if (deleted.length === 0) throw new ReceiptsNotPending();
  },

  async countReceiptsWithFile(path) {
    const [row] = await db.select({ n: count() }).from(receipts).where(eq(receipts.filePath, path));
    return Number(row?.n ?? 0);
  },

  async insertTariff(userId, tariff) {
    await db.insert(tariffs).values({ validFrom: tariff.validFrom, pricePerTon: tariff.pricePerTon, createdBy: userId });
  },

  async findReceiptsForSettlement(ids) {
    if (ids.length === 0) return [];
    return db
      .select({
        id: receipts.id,
        status: receipts.status,
        coteroKey: receipts.coteroKey,
        coteroName: receipts.coteroName,
        coteroDocument: receipts.coteroDocument,
        amount: receipts.amount,
        date: receipts.date,
      })
      .from(receipts)
      .where(inArray(receipts.id, ids));
  },

  async upsertProfile(profile) {
    await db
      .insert(profiles)
      .values(profile)
      .onConflictDoUpdate({
        target: profiles.key,
        set: {
          name: profile.name,
          // What was typed now wins; what was left blank keeps what was remembered.
          document: sql`coalesce(excluded.document, ${profiles.document})`,
          paymentMethod: sql`coalesce(excluded.payment_method, ${profiles.paymentMethod})`,
          paymentAccount: sql`coalesce(excluded.payment_account, ${profiles.paymentAccount})`,
          updatedAt: new Date(),
        },
      });
  },

  async createSettlement(userId, settlement) {
    try {
      return await db.transaction(async (tx) => {
        const [last] = await tx.select({ max: sql<number | null>`max(${settlements.number})` }).from(settlements);
        const [created] = await tx
          .insert(settlements)
          .values({
            number: (last?.max ?? 0) + 1,
            date: settlement.date,
            coteroKey: settlement.coteroKey,
            coteroName: settlement.coteroName,
            coteroDocument: settlement.coteroDocument,
            paymentMethod: settlement.paymentMethod,
            paymentAccount: settlement.paymentAccount,
            total: settlement.total,
            status: "paid",
            paidAt: settlement.paidAt,
            proofPath: settlement.proofPath,
            createdBy: userId,
          })
          .returning({ id: settlements.id, number: settlements.number });
        const taken = await tx
          .update(receipts)
          .set({ status: "paid", settlementId: created.id, updatedAt: new Date() })
          .where(and(inArray(receipts.id, settlement.receiptIds), eq(receipts.status, "pending")))
          .returning({ id: receipts.id });
        if (taken.length !== settlement.receiptIds.length) throw new ReceiptsNotPending();
        return { id: created.id, number: created.number };
      });
    } catch (e) {
      if (e instanceof ReceiptsNotPending) return null;
      throw e;
    }
  },

  async findSettlement(id) {
    const [row] = await db.select({ id: settlements.id, status: settlements.status }).from(settlements).where(eq(settlements.id, id)).limit(1);
    return row ?? null;
  },

  async annulSettlement(id) {
    return db.transaction(async (tx) => {
      const annulled = await tx
        .update(settlements)
        .set({ status: "annulled", annulledAt: new Date() })
        .where(and(eq(settlements.id, id), inArray(settlements.status, ["open", "paid"])))
        .returning({ id: settlements.id });
      if (annulled.length === 0) return false;
      await tx.update(receipts).set({ status: "pending", settlementId: null, updatedAt: new Date() }).where(eq(receipts.settlementId, id));
      return true;
    });
  },

  async paySettlement(id, payment) {
    return db.transaction(async (tx) => {
      const paid = await tx
        .update(settlements)
        .set({ status: "paid", paidAt: payment.paidAt, paymentMethod: payment.paymentMethod, proofPath: payment.proofPath })
        .where(and(eq(settlements.id, id), eq(settlements.status, "open")))
        .returning({ id: settlements.id });
      if (paid.length === 0) return false;
      await tx.update(receipts).set({ status: "paid", updatedAt: new Date() }).where(eq(receipts.settlementId, id));
      return true;
    });
  },
};

export { ReceiptsNotPending };
