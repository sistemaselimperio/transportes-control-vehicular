import { describe, expect, it } from "vitest";
import { DailyCashError, type BoxStatus } from "../domain/box-rules";
import type { CashCount } from "../domain/cash-count";
import type { Company, ParsedVoucher } from "../domain/voucher-import";
import { createDailyCashCommands, type DailyCashPorts, type NewEntry } from "./daily-cash-commands";

const USER = "user-1";

interface Box {
  id: number;
  userId: string;
  date: string;
  status: BoxStatus;
  openingBalance: number | null;
}
interface Entry extends NewEntry {
  id: number;
  boxId: number;
}

/** An in-memory store behind the ports, so the commands are exercised through their effects. */
function fake(seed: { boxes?: Box[]; entries?: Entry[] } = {}) {
  const boxes = [...(seed.boxes ?? [])];
  const entries = [...(seed.entries ?? [])];
  const counts = new Map<number, CashCount>();
  let nextId = 100;
  const ports: DailyCashPorts = {
    async listBoxKeys(userId) {
      return boxes.filter((b) => b.userId === userId).map(({ id, date, status }) => ({ id, date, status }));
    },
    async findBox(userId, id) {
      return boxes.find((b) => b.id === id && b.userId === userId) ?? null;
    },
    async insertBox(userId, values) {
      const box: Box = { id: nextId++, userId, status: "open", ...values };
      boxes.push(box);
      return { id: box.id };
    },
    async setStatus(id, status) {
      boxes.find((b) => b.id === id)!.status = status;
    },
    async setOpeningBalance(id, value) {
      boxes.find((b) => b.id === id)!.openingBalance = value;
    },
    async deleteBox(id) {
      boxes.splice(boxes.findIndex((b) => b.id === id), 1);
    },
    async findEntry(userId, id) {
      const entry = entries.find((e) => e.id === id);
      const box = entry && boxes.find((b) => b.id === entry.boxId && b.userId === userId);
      return entry && box ? { id: entry.id, boxId: entry.boxId, kind: entry.kind, source: entry.source, boxStatus: box.status } : null;
    },
    async insertEntries(boxId, rows) {
      for (const row of rows) entries.push({ ...row, id: nextId++, boxId });
    },
    async updateEntry(id, values) {
      Object.assign(entries.find((e) => e.id === id)!, values);
    },
    async deleteEntry(id) {
      entries.splice(entries.findIndex((e) => e.id === id), 1);
    },
    async findStoredVoucherKeys(rows) {
      const keys = new Set(rows.map((r) => `${r.company}:${r.voucherNumber}`));
      return new Set(entries.filter((e) => e.voucherNumber && keys.has(`${e.company}:${e.voucherNumber}`)).map((e) => `${e.company}:${e.voucherNumber}`));
    },
    async replaceCounts(boxId, next) {
      counts.set(boxId, next);
    },
  };
  return { ports, boxes, entries, counts };
}

const box = (over: Partial<Box> & Pick<Box, "id" | "date">): Box => ({ userId: USER, status: "open", openingBalance: null, ...over });
const voucher = (company: Company, voucherNumber: string): ParsedVoucher => ({ rowNumber: 7, company, voucherNumber, detail: "ANTICIPO", value: 1000 });

describe("createBox", () => {
  it("asks for the opening balance of the first box", async () => {
    const { ports } = fake();
    await expect(createDailyCashCommands(ports).createBox(USER, { date: "2026-11-01", openingBalance: null })).rejects.toThrow(/saldo inicial/i);
  });

  it("stores the opening balance of the first box", async () => {
    const { ports, boxes } = fake();
    await createDailyCashCommands(ports).createBox(USER, { date: "2026-11-01", openingBalance: 500000 });
    expect(boxes[0]).toMatchObject({ date: "2026-11-01", status: "open", openingBalance: 500000 });
  });

  it("does not store an opening balance for a later box", async () => {
    const { ports, boxes } = fake({ boxes: [box({ id: 1, date: "2026-11-01", openingBalance: 10 })] });
    await createDailyCashCommands(ports).createBox(USER, { date: "2026-11-02", openingBalance: 999 });
    expect(boxes[1].openingBalance).toBeNull();
  });

  it("refuses a second box for the same date", async () => {
    const { ports } = fake({ boxes: [box({ id: 1, date: "2026-11-01", openingBalance: 10 })] });
    await expect(createDailyCashCommands(ports).createBox(USER, { date: "2026-11-01", openingBalance: null })).rejects.toThrow(/ya hay una caja/i);
  });

  it("asks for the opening balance again when the new box would be the earliest", async () => {
    const { ports } = fake({ boxes: [box({ id: 1, date: "2026-11-05", openingBalance: 10 })] });
    await expect(createDailyCashCommands(ports).createBox(USER, { date: "2026-11-01", openingBalance: null })).rejects.toThrow(/saldo inicial/i);
  });
});

describe("createBox with closed boxes", () => {
  const closed = () => fake({ boxes: [box({ id: 1, date: "2026-11-05", openingBalance: 10, status: "closed" })] });

  it("refuses a date before the latest closed box", async () => {
    const { ports } = closed();
    await expect(createDailyCashCommands(ports).createBox(USER, { date: "2026-11-01", openingBalance: 5 })).rejects.toThrow(/cerrada/i);
  });

  it("allows a date after it", async () => {
    const { ports, boxes } = closed();
    await createDailyCashCommands(ports).createBox(USER, { date: "2026-11-06", openingBalance: null });
    expect(boxes).toHaveLength(2);
  });

  it("allows an earlier date when no closed box comes after it", async () => {
    const { ports, boxes } = fake({ boxes: [box({ id: 1, date: "2026-11-05", openingBalance: 10 })] });
    await createDailyCashCommands(ports).createBox(USER, { date: "2026-11-01", openingBalance: 5 });
    expect(boxes).toHaveLength(2);
  });
});

describe("closing and reopening", () => {
  it("closes a box whose previous box is closed", async () => {
    const { ports, boxes } = fake({ boxes: [box({ id: 1, date: "2026-11-01", status: "closed" }), box({ id: 2, date: "2026-11-02" })] });
    await createDailyCashCommands(ports).closeBox(USER, 2);
    expect(boxes[1].status).toBe("closed");
  });

  it("refuses to close while the previous box is still open", async () => {
    const { ports } = fake({ boxes: [box({ id: 1, date: "2026-11-01" }), box({ id: 2, date: "2026-11-02" })] });
    await expect(createDailyCashCommands(ports).closeBox(USER, 2)).rejects.toThrow(/01\/11\/2026/);
  });

  it("reopens a closed box", async () => {
    const { ports, boxes } = fake({ boxes: [box({ id: 1, date: "2026-11-01", status: "closed" })] });
    await createDailyCashCommands(ports).reopenBox(USER, 1);
    expect(boxes[0].status).toBe("open");
  });

  it("does not touch a box of another user", async () => {
    const { ports } = fake({ boxes: [box({ id: 1, date: "2026-11-01", userId: "other" })] });
    await expect(createDailyCashCommands(ports).closeBox(USER, 1)).rejects.toThrow(DailyCashError);
  });
});

describe("deleteBox", () => {
  it("deletes an open box", async () => {
    const { ports, boxes } = fake({ boxes: [box({ id: 1, date: "2026-11-01" })] });
    await createDailyCashCommands(ports).deleteBox(USER, 1);
    expect(boxes).toEqual([]);
  });

  it("refuses to delete a closed box", async () => {
    const { ports } = fake({ boxes: [box({ id: 1, date: "2026-11-01", status: "closed" })] });
    await expect(createDailyCashCommands(ports).deleteBox(USER, 1)).rejects.toThrow(/cerrada/i);
  });
});

describe("deleteBox order", () => {
  it("refuses to delete a box that has a later one", async () => {
    const { ports, boxes } = fake({ boxes: [box({ id: 1, date: "2026-11-01", openingBalance: 10 }), box({ id: 2, date: "2026-11-02" })] });
    await expect(createDailyCashCommands(ports).deleteBox(USER, 1)).rejects.toThrow(/última caja/i);
    expect(boxes).toHaveLength(2);
  });

  it("deletes the latest box", async () => {
    const { ports, boxes } = fake({ boxes: [box({ id: 1, date: "2026-11-01", openingBalance: 10 }), box({ id: 2, date: "2026-11-02" })] });
    await createDailyCashCommands(ports).deleteBox(USER, 2);
    expect(boxes.map((b) => b.id)).toEqual([1]);
  });
});

describe("opening balance", () => {
  it("can be changed on the first open box", async () => {
    const { ports, boxes } = fake({ boxes: [box({ id: 1, date: "2026-11-01", openingBalance: 10 })] });
    await createDailyCashCommands(ports).setOpeningBalance(USER, 1, 50);
    expect(boxes[0].openingBalance).toBe(50);
  });

  it("cannot be typed on a later box", async () => {
    const { ports } = fake({ boxes: [box({ id: 1, date: "2026-11-01", openingBalance: 10 }), box({ id: 2, date: "2026-11-02" })] });
    await expect(createDailyCashCommands(ports).setOpeningBalance(USER, 2, 50)).rejects.toThrow(/primera caja/i);
  });
});

describe("manual entries", () => {
  const open = () => fake({ boxes: [box({ id: 1, date: "2026-11-01", openingBalance: 10 })] });

  it("adds a manual expense without a voucher", async () => {
    const { ports, entries } = open();
    await createDailyCashCommands(ports).addExpense(USER, 1, { company: "EGT", detail: "Peaje", value: 12000 });
    expect(entries[0]).toMatchObject({ kind: "expense", company: "EGT", voucherNumber: null, detail: "Peaje", value: 12000, source: "manual" });
  });

  it("adds a manual income without a company", async () => {
    const { ports, entries } = open();
    await createDailyCashCommands(ports).addIncome(USER, 1, { detail: "Recarga almacén", value: 300000 });
    expect(entries[0]).toMatchObject({ kind: "income", company: null, voucherNumber: null, source: "manual" });
  });

  it("refuses changes on a closed box", async () => {
    const { ports } = fake({ boxes: [box({ id: 1, date: "2026-11-01", status: "closed" })] });
    await expect(createDailyCashCommands(ports).addExpense(USER, 1, { company: "EC1", detail: "x", value: 1 })).rejects.toThrow(/cerrada/i);
  });

  it("edits a manual entry", async () => {
    const { ports, entries } = open();
    const commands = createDailyCashCommands(ports);
    await commands.addExpense(USER, 1, { company: "EC1", detail: "Peaje", value: 12000 });
    await commands.updateEntry(USER, entries[0].id, { company: "EGT", detail: "Peaje ida", value: 15000 });
    expect(entries[0]).toMatchObject({ company: "EGT", detail: "Peaje ida", value: 15000 });
  });

  it("does not edit an imported entry", async () => {
    const { ports, entries } = open();
    const commands = createDailyCashCommands(ports);
    await commands.confirmImport(USER, 1, [voucher("EC1", "1")]);
    await expect(commands.updateEntry(USER, entries[0].id, { company: "EC1", detail: "x", value: 1 })).rejects.toThrow(/importado/i);
  });

  it("deletes an imported entry, which frees its voucher number", async () => {
    const { ports, entries } = open();
    const commands = createDailyCashCommands(ports);
    await commands.confirmImport(USER, 1, [voucher("EC1", "1")]);
    await commands.deleteEntry(USER, entries[0].id);
    expect(entries).toEqual([]);
    expect((await commands.previewImport([voucher("EC1", "1")])).toImport).toHaveLength(1);
  });

  it("refuses to delete an entry of a closed box", async () => {
    const { ports } = fake({
      boxes: [box({ id: 1, date: "2026-11-01", status: "closed" })],
      entries: [{ id: 5, boxId: 1, kind: "income", company: null, voucherNumber: null, detail: "x", value: 1, source: "manual" }],
    });
    await expect(createDailyCashCommands(ports).deleteEntry(USER, 5)).rejects.toThrow(/cerrada/i);
  });
});

describe("importing vouchers", () => {
  it("saves the new vouchers as imported expenses of the open box", async () => {
    const { ports, entries } = fake({ boxes: [box({ id: 1, date: "2026-11-01", openingBalance: 10 })] });
    const result = await createDailyCashCommands(ports).confirmImport(USER, 1, [voucher("EC1", "5142"), voucher("EGT", "900")]);
    expect(result).toEqual({ imported: 2, duplicates: 0 });
    expect(entries.map((e) => [e.kind, e.company, e.voucherNumber, e.source])).toEqual([
      ["expense", "EC1", "5142", "import"],
      ["expense", "EGT", "900", "import"],
    ]);
  });

  it("blocks a voucher already stored in another box", async () => {
    const { ports, entries } = fake({
      boxes: [box({ id: 1, date: "2026-11-01", openingBalance: 10, status: "closed" }), box({ id: 2, date: "2026-11-02" })],
      entries: [{ id: 5, boxId: 1, kind: "expense", company: "EC1", voucherNumber: "5142", detail: "x", value: 1, source: "import" }],
    });
    const result = await createDailyCashCommands(ports).confirmImport(USER, 2, [voucher("EC1", "5142"), voucher("EC1", "5143")]);
    expect(result).toEqual({ imported: 1, duplicates: 1 });
    expect(entries.filter((e) => e.boxId === 2).map((e) => e.voucherNumber)).toEqual(["5143"]);
  });

  it("refuses to import when everything is a duplicate", async () => {
    const { ports } = fake({ boxes: [box({ id: 1, date: "2026-11-01", openingBalance: 10 })] });
    const commands = createDailyCashCommands(ports);
    await commands.confirmImport(USER, 1, [voucher("EC1", "1")]);
    await expect(commands.confirmImport(USER, 1, [voucher("EC1", "1")])).rejects.toThrow(/nuevos/i);
  });

  it("refuses to import into a closed box", async () => {
    const { ports } = fake({ boxes: [box({ id: 1, date: "2026-11-01", status: "closed" })] });
    await expect(createDailyCashCommands(ports).confirmImport(USER, 1, [voucher("EC1", "1")])).rejects.toThrow(/cerrada/i);
  });
});

describe("saveCounts", () => {
  it("replaces the arqueo of an open box", async () => {
    const { ports, counts } = fake({ boxes: [box({ id: 1, date: "2026-11-01", openingBalance: 10 })] });
    await createDailyCashCommands(ports).saveCounts(USER, 1, { 100000: 2, 500: 3 });
    expect(counts.get(1)).toEqual({ 100000: 2, 500: 3 });
  });

  it("refuses a closed box", async () => {
    const { ports } = fake({ boxes: [box({ id: 1, date: "2026-11-01", status: "closed" })] });
    await expect(createDailyCashCommands(ports).saveCounts(USER, 1, {})).rejects.toThrow(/cerrada/i);
  });
});
