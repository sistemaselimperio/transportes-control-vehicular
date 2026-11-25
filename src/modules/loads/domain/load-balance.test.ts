import { describe, expect, it } from "vitest";
import {
  balanceDraftError,
  balanceLeftText,
  balanceBagsError,
  buildBalanceDrafts,
  buildPendingBalances,
  hasTrips,
  pendingEntries,
  remainingBags,
  tripBagsError,
  type BalanceDraft,
  type LoadBalanceRow,
} from "./load-balance";
import type { PendingOrderRow, PendingSource } from "./load-pending";

const balance = (over: Partial<LoadBalanceRow> = {}): LoadBalanceRow => ({
  id: 1,
  loadId: 10,
  orderId: 1,
  supplier: "Contegral",
  loadDate: "2026-11-20",
  bags: 5,
  scheduledDate: "2026-11-20",
  plate: null,
  trips: [],
  ...over,
});

const trip = (id: number, bags: number, date = "2026-11-22") => ({ id, date, plate: "ABC-123", bags });

const line = (supplier: "Finca" | "Contegral", bags: number, clientName = "Cliente 1") => ({
  id: bags,
  clientId: 1,
  clientName,
  locationId: null,
  locationName: null,
  referenceId: 5,
  referenceName: "Producto 5",
  referenceCode: "C5",
  supplier,
  bags,
});

const source = (id: number, over: Partial<PendingSource> = {}): PendingSource => ({
  id,
  status: "cargado",
  deliveryDate: "2026-11-18",
  timeWindow: null,
  pendingSuppliers: [],
  lines: [line("Contegral", 330)],
  ...over,
});

describe("remainingBags and hasTrips", () => {
  it("subtracts the bags of every trip from the balance", () => {
    expect(remainingBags(balance())).toBe(5);
    expect(remainingBags(balance({ trips: [trip(1, 2), trip(2, 1)] }))).toBe(2);
    expect(remainingBags(balance({ trips: [trip(1, 5)] }))).toBe(0);
  });

  it("never goes below zero", () => {
    expect(remainingBags(balance({ trips: [trip(1, 9)] }))).toBe(0);
  });

  it("tells whether a trip was registered", () => {
    expect(hasTrips(balance())).toBe(false);
    expect(hasTrips(balance({ trips: [trip(1, 1)] }))).toBe(true);
  });
});

describe("balanceBagsError", () => {
  it("accepts a whole number above zero and below the bags of the order", () => {
    expect(balanceBagsError(5, 330)).toBeNull();
    expect(balanceBagsError(1, 2)).toBeNull();
    expect(balanceBagsError(329, 330)).toBeNull();
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects %s", (bags) => {
    expect(balanceBagsError(bags, 330)).toBe("Los bultos que se quedan deben ser un número entero mayor que cero y menor que los 330 bultos del pedido.");
  });

  it("rejects the whole order or more: that is not a leftover", () => {
    expect(balanceBagsError(330, 330)).toMatch(/menor que los 330 bultos/);
    expect(balanceBagsError(400, 330)).toMatch(/menor que los 330 bultos/);
  });
});

describe("tripBagsError", () => {
  it("accepts 1 up to the remaining bags", () => {
    expect(tripBagsError(1, 5)).toBeNull();
    expect(tripBagsError(5, 5)).toBeNull();
  });

  it.each([0, -2, 1.5, 6])("rejects %s of 5 remaining", (bags) => {
    expect(tripBagsError(bags, 5)).toBe("Los bultos del viaje deben ser un número entero entre 1 y 5.");
  });
});

describe("balanceLeftText", () => {
  it("pluralizes and shows the date and the plate", () => {
    const [row] = buildPendingBalances([balance({ scheduledDate: "2026-11-25", plate: "ABC-123" })], [source(1)]);
    expect(balanceLeftText(row!)).toBe("Quedan 5 bultos por llevar · 25 nov · ABC-123");
  });

  it("says 'sin placa' and uses the singular", () => {
    const [row] = buildPendingBalances([balance({ bags: 1 })], [source(1)]);
    expect(balanceLeftText(row!)).toBe("Queda 1 bulto por llevar · 20 nov · sin placa");
  });
});

describe("buildPendingBalances", () => {
  it("lists balances with bags left, with the clients of the supplier part", () => {
    const orders = [source(1, { lines: [line("Contegral", 330, "Agro Uno"), line("Finca", 10, "Otro")] })];
    const rows = buildPendingBalances([balance({ trips: [trip(1, 2)] })], orders);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      balanceId: 1,
      loadId: 10,
      orderId: 1,
      supplier: "Contegral",
      remaining: 3,
      scheduledDate: "2026-11-20",
      plate: null,
      clients: ["Agro Uno"],
    });
  });

  it("leaves out the balances fully carried and the ones of an order that is not listed", () => {
    expect(buildPendingBalances([balance({ trips: [trip(1, 5)] })], [source(1)])).toEqual([]);
    expect(buildPendingBalances([balance({ orderId: 99 })], [source(1)])).toEqual([]);
  });

  it("flags a balance moved off the load date and remembers the original day", () => {
    const rows = buildPendingBalances(
      [balance({ id: 1, scheduledDate: "2026-11-20" }), balance({ id: 2, orderId: 2, scheduledDate: "2026-11-24" })],
      [source(1), source(2)],
    );
    expect(rows.map((r) => [r.balanceId, r.rescheduled, r.originalDate])).toEqual([
      [1, false, "2026-11-20"],
      [2, true, "2026-11-20"],
    ]);
  });

  it("sorts by scheduled date, then balance id", () => {
    const rows = buildPendingBalances(
      [
        balance({ id: 3, orderId: 3, scheduledDate: "2026-11-25" }),
        balance({ id: 2, orderId: 2, scheduledDate: "2026-11-21" }),
        balance({ id: 1, orderId: 1, scheduledDate: "2026-11-21" }),
      ],
      [source(1), source(2), source(3)],
    );
    expect(rows.map((r) => r.balanceId)).toEqual([1, 2, 3]);
  });
});

describe("pendingEntries", () => {
  const orderRow = (id: number, deliveryDate: string): PendingOrderRow => ({
    id,
    deliveryDate,
    timeWindow: null,
    suppliers: ["Finca"],
    clients: [],
    bags: 1,
    tons: 0.04,
    parts: [],
  });

  it("merges orders (by delivery day) and balances (by scheduled day) in one list", () => {
    const balances = buildPendingBalances(
      [balance({ id: 1, orderId: 1, scheduledDate: "2026-11-21" }), balance({ id: 2, orderId: 2, scheduledDate: "2026-11-30" })],
      [source(1), source(2)],
    );
    const entries = pendingEntries([orderRow(7, "2026-11-19"), orderRow(8, "2026-11-25")], balances);
    expect(entries.map((e) => (e.kind === "order" ? `o${e.row.id}` : `b${e.row.balanceId}`))).toEqual(["o7", "b1", "o8", "b2"]);
  });

  it("puts the order before the balance on the same day", () => {
    const balances = buildPendingBalances([balance({ scheduledDate: "2026-11-19" })], [source(1)]);
    const entries = pendingEntries([orderRow(7, "2026-11-19")], balances);
    expect(entries.map((e) => e.kind)).toEqual(["order", "balance"]);
  });
});

describe("balance drafts", () => {
  const blocks = [
    { orderId: 1, supplier: "Contegral" as const },
    { orderId: 2, supplier: "Finca" as const },
  ];

  it("starts unchecked, following the load date, one per block", () => {
    expect(buildBalanceDrafts(blocks)).toEqual([
      { orderId: 1, supplier: "Contegral", enabled: false, bags: "", date: null, plate: "" },
      { orderId: 2, supplier: "Finca", enabled: false, bags: "", date: null, plate: "" },
    ]);
  });

  it("fills the checked ones from the stored balances", () => {
    const drafts = buildBalanceDrafts(blocks, [balance({ bags: 5, scheduledDate: "2026-11-24", plate: "ABC-123" })]);
    expect(drafts[0]).toEqual({ orderId: 1, supplier: "Contegral", enabled: true, bags: "5", date: "2026-11-24", plate: "ABC-123" });
    expect(drafts[1]?.enabled).toBe(false);
  });

  const draft = (over: Partial<BalanceDraft> = {}): BalanceDraft => ({
    orderId: 1,
    supplier: "Contegral",
    enabled: true,
    bags: "5",
    date: null,
    plate: "",
    ...over,
  });

  it("ignores an unchecked draft", () => {
    expect(balanceDraftError(draft({ enabled: false, bags: "zzz" }), 330, "2026-11-20")).toBeNull();
  });

  it("accepts a checked draft with valid bags and a date, falling back to the load date", () => {
    expect(balanceDraftError(draft(), 330, "2026-11-20")).toBeNull();
  });

  it("names the order when the bags are not valid", () => {
    expect(balanceDraftError(draft({ bags: "" }), 330, "2026-11-20")).toMatch(/^Pedido #1: Los bultos que se quedan/);
    expect(balanceDraftError(draft({ bags: "330" }), 330, "2026-11-20")).toMatch(/^Pedido #1: /);
    expect(balanceDraftError(draft({ bags: "2,5" }), 330, "2026-11-20")).toMatch(/^Pedido #1: /);
  });

  it("requires a date for the balance", () => {
    expect(balanceDraftError(draft(), 330, "")).toBe("Pedido #1: elige la fecha del saldo.");
  });
});
