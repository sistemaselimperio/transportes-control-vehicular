import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { DailyCashPorts } from "../application/daily-cash-commands";
import type { BoxInput } from "../domain/box-balances";
import type { BoxKey } from "../domain/box-rules";
import type { EntryRow } from "../domain/daily-cash-rows";
import { DENOMINATIONS } from "../domain/cash-count";
import { voucherKey } from "../domain/voucher-import";

const { dailyCashBoxes: boxes, dailyCashEntries: entries, dailyCashCounts: counts } = schema;

/** The figures every box needs for the chain: its typed balance and the sums of its entries and arqueo. */
export async function loadBoxInputs(userId: string): Promise<BoxInput[]> {
  const [boxRows, entrySums, countSums] = await Promise.all([
    db
      .select({ id: boxes.id, date: boxes.date, status: boxes.status, openingBalance: boxes.openingBalance })
      .from(boxes)
      .where(eq(boxes.userId, userId))
      .orderBy(asc(boxes.date)),
    db
      .select({ boxId: entries.boxId, kind: entries.kind, company: entries.company, total: sql<string>`coalesce(sum(${entries.value}), 0)` })
      .from(entries)
      .innerJoin(boxes, eq(boxes.id, entries.boxId))
      .where(eq(boxes.userId, userId))
      .groupBy(entries.boxId, entries.kind, entries.company),
    db
      .select({ boxId: counts.boxId, total: sql<string>`coalesce(sum(${counts.denomination}::bigint * ${counts.quantity}::bigint), 0)` })
      .from(counts)
      .innerJoin(boxes, eq(boxes.id, counts.boxId))
      .where(eq(boxes.userId, userId))
      .groupBy(counts.boxId),
  ]);
  return boxRows.map((b) => {
    const mine = entrySums.filter((s) => s.boxId === b.id);
    const sum = (match: (s: (typeof mine)[number]) => boolean) => mine.filter(match).reduce((acc, s) => acc + Number(s.total), 0);
    return {
      id: b.id,
      date: b.date,
      status: b.status,
      openingBalance: b.openingBalance,
      manualIncomeTotal: sum((s) => s.kind === "income"),
      ec1Total: sum((s) => s.kind === "expense" && s.company === "EC1"),
      egtTotal: sum((s) => s.kind === "expense" && s.company === "EGT"),
      countedTotal: Number(countSums.find((c) => c.boxId === b.id)?.total ?? 0),
    };
  });
}

/** The entries and the arqueo of one box of the user; null when it does not exist or is someone else's. */
export async function loadBoxContents(userId: string, id: number): Promise<{ entries: EntryRow[]; counts: Record<number, number> } | null> {
  const [box] = await db.select({ id: boxes.id }).from(boxes).where(and(eq(boxes.id, id), eq(boxes.userId, userId))).limit(1);
  if (!box) return null;
  const [entryRows, countRows] = await Promise.all([
    db.select().from(entries).where(eq(entries.boxId, id)).orderBy(asc(entries.id)),
    db.select().from(counts).where(eq(counts.boxId, id)),
  ]);
  return {
    counts: Object.fromEntries(countRows.map((c) => [c.denomination, c.quantity])),
    entries: entryRows.map((e) => ({
      id: e.id,
      kind: e.kind,
      company: e.company,
      voucherNumber: e.voucherNumber,
      detail: e.detail,
      value: e.value,
      source: e.source,
    })),
  };
}

export const dailyCashRepository: DailyCashPorts = {
  async listBoxKeys(userId) {
    const rows = await db.select({ id: boxes.id, date: boxes.date, status: boxes.status }).from(boxes).where(eq(boxes.userId, userId));
    return rows satisfies BoxKey[];
  },

  async findBox(userId, id) {
    const [row] = await db
      .select({ id: boxes.id, date: boxes.date, status: boxes.status, openingBalance: boxes.openingBalance })
      .from(boxes)
      .where(and(eq(boxes.id, id), eq(boxes.userId, userId)))
      .limit(1);
    return row ?? null;
  },

  async insertBox(userId, values) {
    const [row] = await db.insert(boxes).values({ userId, date: values.date, openingBalance: values.openingBalance }).returning({ id: boxes.id });
    return row;
  },

  async setStatus(id, status) {
    await db.update(boxes).set({ status, updatedAt: new Date() }).where(eq(boxes.id, id));
  },

  async setOpeningBalance(id, value) {
    await db.update(boxes).set({ openingBalance: value, updatedAt: new Date() }).where(eq(boxes.id, id));
  },

  async deleteBox(id) {
    await db.delete(boxes).where(eq(boxes.id, id));
  },

  async findEntry(userId, id) {
    const [row] = await db
      .select({ id: entries.id, boxId: entries.boxId, kind: entries.kind, source: entries.source, boxStatus: boxes.status })
      .from(entries)
      .innerJoin(boxes, eq(boxes.id, entries.boxId))
      .where(and(eq(entries.id, id), eq(boxes.userId, userId)))
      .limit(1);
    return row ?? null;
  },

  async insertEntries(boxId, rows) {
    // One statement: all the rows or none.
    await db.insert(entries).values(rows.map((r) => ({ ...r, boxId })));
  },

  async updateEntry(id, values) {
    await db.update(entries).set({ ...values, updatedAt: new Date() }).where(eq(entries.id, id));
  },

  async deleteEntry(id) {
    await db.delete(entries).where(eq(entries.id, id));
  },

  async findStoredVoucherKeys(rows) {
    const numbers = [...new Set(rows.map((r) => r.voucherNumber))];
    if (numbers.length === 0) return new Set();
    const stored = await db
      .select({ company: entries.company, voucherNumber: entries.voucherNumber })
      .from(entries)
      .where(inArray(entries.voucherNumber, numbers));
    return new Set(stored.flatMap((s) => (s.company && s.voucherNumber ? [voucherKey(s.company, s.voucherNumber)] : [])));
  },

  async replaceCounts(boxId, next) {
    await db.transaction(async (tx) => {
      await tx.delete(counts).where(eq(counts.boxId, boxId));
      const rows = DENOMINATIONS.flatMap((denomination) => {
        const quantity = next[denomination] ?? 0;
        return quantity > 0 ? [{ boxId, denomination, quantity }] : [];
      });
      if (rows.length > 0) await tx.insert(counts).values(rows);
    });
  },
};
