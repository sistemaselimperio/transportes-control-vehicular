import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { LedgerNumberTakenError, type PettyCashPorts, type StoredAttachment } from "../application/petty-cash-commands";
import { computeLedgerChain, firstLedgerId } from "../domain/ledger-balances";
import type { ExpenseRow, LedgerFigures, LedgerSheet, OwnerOption, SupplierRow, VehicleOption } from "../domain/petty-cash-rows";

const { pettyCashAccounts: accounts, pettyCashLedgers: ledgers, pettyCashExpenses: expenses, pettyCashSuppliers: suppliers } = schema;

/** The ledgers of a user with their expense totals, plus the typed opening balance of the first one. */
export async function loadLedgerFigures(userId: string): Promise<LedgerFigures> {
  const [account] = await db.select().from(accounts).where(eq(accounts.userId, userId)).limit(1);
  const rows = await db
    .select({
      id: ledgers.id,
      number: ledgers.number,
      date: ledgers.date,
      compenseAmount: ledgers.compenseAmount,
      expensesTotal: sql<number>`coalesce(sum(${expenses.value}), 0)::int`,
    })
    .from(ledgers)
    .leftJoin(expenses, eq(expenses.ledgerId, ledgers.id))
    .where(eq(ledgers.userId, userId))
    .groupBy(ledgers.id);
  return { initialBalance: account?.initialBalance ?? 0, ledgers: rows };
}

/** How many expenses of each ledger of the user still need review, by ledger id (ledgers with none are absent). */
export async function loadReviewCounts(userId: string): Promise<Record<number, number>> {
  const rows = await db
    .select({ ledgerId: expenses.ledgerId, count: sql<number>`count(*)::int` })
    .from(expenses)
    .innerJoin(ledgers, eq(ledgers.id, expenses.ledgerId))
    .where(and(eq(ledgers.userId, userId), eq(expenses.needsReview, true)))
    .groupBy(expenses.ledgerId);
  return Object.fromEntries(rows.map((r) => [r.ledgerId, r.count]));
}

function toExpenseRow(r: typeof expenses.$inferSelect): ExpenseRow {
  return {
    id: r.id,
    detail: r.detail,
    invoiceNumber: r.invoiceNumber,
    efk: r.efk,
    nit: r.nit,
    supplierName: r.supplierName,
    company: r.company,
    responsibilityType: r.responsibilityType,
    vehicleId: r.vehicleId,
    vehicleLabel: r.vehicleLabel,
    value: r.value,
    attachment: r.attachmentPath ? { name: r.attachmentName ?? "Adjunto", mimeType: r.attachmentMime ?? "" } : null,
    needsReview: r.needsReview,
    possibleDuplicate: r.possibleDuplicate,
  };
}

/** How a ledger of the user is looked up: by its permanent number (URLs) or by its database id (old URLs). */
export type LedgerSelector = { number: number } | { id: number };

/** One ledger of the user (null when it is not theirs) with balances from the whole chain. */
export async function loadLedgerSheet(userId: string, selector: LedgerSelector): Promise<LedgerSheet | null> {
  const figures = await loadLedgerFigures(userId);
  const balance = computeLedgerChain(figures.initialBalance, figures.ledgers).find((l) =>
    "number" in selector ? l.number === selector.number : l.id === selector.id,
  );
  if (!balance) return null;
  const ledgerId = balance.id;
  const rows = await db.select().from(expenses).where(eq(expenses.ledgerId, ledgerId)).orderBy(asc(expenses.id));
  return {
    balance,
    expenses: rows.map(toExpenseRow),
    isFirst: firstLedgerId(figures.ledgers) === ledgerId,
    ledgerKeys: figures.ledgers.map((l) => ({ id: l.id, date: l.date })),
  };
}

export async function loadSuppliers(): Promise<SupplierRow[]> {
  const rows = await db.select().from(suppliers).orderBy(asc(suppliers.nit));
  return rows.map((r) => ({ nit: r.nit, supplierName: r.supplierName, responsibilityType: r.responsibilityType }));
}

/** The owners an invoice can be billed to, by name. */
export async function loadOwnerOptions(): Promise<OwnerOption[]> {
  return db.select({ id: schema.owners.id, name: schema.owners.name }).from(schema.owners).orderBy(asc(schema.owners.name));
}

/** Every vehicle of the fleet, sold ones included: an old expense may have been for one. */
export async function loadVehicleOptions(): Promise<VehicleOption[]> {
  return db
    .select({ plate: schema.vehicles.plate, className: schema.vehicleClasses.name })
    .from(schema.vehicles)
    .innerJoin(schema.vehicleClasses, eq(schema.vehicleClasses.id, schema.vehicles.classId))
    .orderBy(asc(schema.vehicles.plate));
}

/** The number of the user's ledger with this database id; null when it is not theirs. */
export async function findLedgerNumber(userId: string, id: number): Promise<number | null> {
  const [row] = await db
    .select({ number: ledgers.number })
    .from(ledgers)
    .where(and(eq(ledgers.id, id), eq(ledgers.userId, userId)))
    .limit(1);
  return row?.number ?? null;
}

/** The attachment of an expense, only when its ledger belongs to the user. */
export async function findExpenseAttachment(userId: string, expenseId: number): Promise<StoredAttachment | null> {
  const [row] = await db
    .select({ path: expenses.attachmentPath, name: expenses.attachmentName, mimeType: expenses.attachmentMime })
    .from(expenses)
    .innerJoin(ledgers, eq(ledgers.id, expenses.ledgerId))
    .where(and(eq(expenses.id, expenseId), eq(ledgers.userId, userId)))
    .limit(1);
  if (!row?.path) return null;
  return { path: row.path, name: row.name ?? "adjunto", mimeType: row.mimeType ?? "application/octet-stream" };
}

const attachmentColumns = (a: StoredAttachment | null) => ({
  attachmentPath: a?.path ?? null,
  attachmentName: a?.name ?? null,
  attachmentMime: a?.mimeType ?? null,
});

/** Postgres 23505, whether pg raised it directly or drizzle wrapped it as the cause. */
function isUniqueViolation(e: unknown): boolean {
  for (let err = e; typeof err === "object" && err !== null; err = (err as { cause?: unknown }).cause) {
    if ((err as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

export const pettyCashRepository: PettyCashPorts = {
  async listLedgerKeys(userId) {
    return db.select({ id: ledgers.id, date: ledgers.date, number: ledgers.number }).from(ledgers).where(eq(ledgers.userId, userId));
  },

  async setInitialBalance(userId, amount) {
    await db
      .insert(accounts)
      .values({ userId, initialBalance: amount })
      .onConflictDoUpdate({ target: accounts.userId, set: { initialBalance: amount } });
  },

  async insertLedger(userId, values) {
    try {
      const [row] = await db.insert(ledgers).values({ userId, ...values }).returning({ id: ledgers.id });
      return row;
    } catch (e) {
      if (isUniqueViolation(e)) throw new LedgerNumberTakenError();
      throw e;
    }
  },

  async updateLedger(userId, id, values) {
    const rows = await db
      .update(ledgers)
      .set(values)
      .where(and(eq(ledgers.id, id), eq(ledgers.userId, userId)))
      .returning({ id: ledgers.id });
    return rows.length === 1;
  },

  async findLedger(userId, id) {
    const [row] = await db
      .select({ id: ledgers.id, date: ledgers.date })
      .from(ledgers)
      .where(and(eq(ledgers.id, id), eq(ledgers.userId, userId)))
      .limit(1);
    return row ?? null;
  },

  async deleteLedger(userId, id) {
    const files = await db
      .select({ path: expenses.attachmentPath })
      .from(expenses)
      .innerJoin(ledgers, eq(ledgers.id, expenses.ledgerId))
      .where(and(eq(ledgers.id, id), eq(ledgers.userId, userId)));
    const rows = await db
      .delete(ledgers)
      .where(and(eq(ledgers.id, id), eq(ledgers.userId, userId)))
      .returning({ id: ledgers.id });
    if (rows.length === 0) return null;
    return files.flatMap((f) => (f.path ? [f.path] : []));
  },

  async findVehicleByPlate(plate) {
    const [vehicle] = await db
      .select({ id: schema.vehicles.id, plate: schema.vehicles.plate })
      .from(schema.vehicles)
      .where(eq(schema.vehicles.plate, plate))
      .limit(1);
    return vehicle ?? null;
  },

  listOwners: loadOwnerOptions,

  async listFleet() {
    return db.select({ id: schema.vehicles.id, plate: schema.vehicles.plate }).from(schema.vehicles).orderBy(asc(schema.vehicles.plate));
  },

  listSuppliers: loadSuppliers,

  async listInvoiceNumbers(userId, nit, excludeExpenseId) {
    const rows = await db
      .select({ invoiceNumber: expenses.invoiceNumber })
      .from(expenses)
      .innerJoin(ledgers, eq(ledgers.id, expenses.ledgerId))
      .where(
        and(
          eq(ledgers.userId, userId),
          eq(expenses.nit, nit),
          excludeExpenseId === undefined ? undefined : ne(expenses.id, excludeExpenseId),
        ),
      );
    return rows.map((r) => r.invoiceNumber);
  },

  async insertExpense(ledgerId, values) {
    const { attachment, ...rest } = values;
    await db.insert(expenses).values({ ledgerId, ...rest, ...attachmentColumns(attachment) });
  },

  async findExpense(userId, id) {
    const [row] = await db
      .select({ id: expenses.id, ledgerId: expenses.ledgerId, attachmentPath: expenses.attachmentPath })
      .from(expenses)
      .innerJoin(ledgers, eq(ledgers.id, expenses.ledgerId))
      .where(and(eq(expenses.id, id), eq(ledgers.userId, userId)))
      .limit(1);
    return row ?? null;
  },

  async updateExpense(id, values) {
    const { attachment, ...rest } = values;
    const rows = await db
      .update(expenses)
      .set({ ...rest, ...(attachment === undefined ? {} : attachmentColumns(attachment)) })
      .where(eq(expenses.id, id))
      .returning({ id: expenses.id });
    return rows.length === 1;
  },

  async deleteExpense(id) {
    const rows = await db.delete(expenses).where(eq(expenses.id, id)).returning({ id: expenses.id });
    return rows.length === 1;
  },

  async upsertSupplier(supplier) {
    await db
      .insert(suppliers)
      .values(supplier)
      .onConflictDoUpdate({
        target: suppliers.nit,
        set: {
          // A blank name or responsibility must not erase the one already known for this NIT.
          supplierName: sql`coalesce(excluded.supplier_name, ${suppliers.supplierName})`,
          responsibilityType: sql`coalesce(excluded.responsibility_type, ${suppliers.responsibilityType})`,
          updatedAt: new Date(),
        },
      });
  },
};
