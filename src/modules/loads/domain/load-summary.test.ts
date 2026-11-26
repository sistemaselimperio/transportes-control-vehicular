import { describe, expect, it } from "vitest";
import type { LoadLineRow } from "./load-lines";
import type { LoadRow } from "./load-rules";
import { buildLoadSummary } from "./load-summary";

let lineId = 0;
const line = (siesaNumber: string, orderNumber: string, tons: number, cost: number, orderId = 1): LoadLineRow => ({
  id: ++lineId,
  orderId,
  referenceId: 10,
  referenceName: "Ternera",
  referenceCode: null,
  tons,
  cost,
  siesaNumber,
  orderNumber,
});

const load = (id: number, overrides: Partial<LoadRow>): LoadRow => ({
  id,
  date: "2026-11-20" as LoadRow["date"],
  supplier: "Finca",
  plate: "ABC123",
  vehicleId: 1,
  tons: 0,
  cost: 0,
  lines: [],
  notes: null,
  orders: [],
  ...overrides,
});

describe("buildLoadSummary", () => {
  it("gives one row per SIESA and supplier order of a load, adding their kilos and cost", () => {
    const summary = buildLoadSummary([
      load(1, {
        plate: "J51978",
        lines: [line("1611117", "175826", 6, 12_000_000), line("1611117", "175826", 4.52, 8_554_228), line("1611129", "175830", 8.36, 16_428_730, 2)],
      }),
    ]);

    expect(summary).toEqual([
      {
        supplier: "Finca",
        days: [
          {
            date: "2026-11-20",
            vehicles: [
              {
                plate: "J51978",
                kg: 18_880,
                cost: 36_982_958,
                rows: [
                  { loadId: 1, siesaNumber: "1611117", orderNumber: "175826", kg: 10_520, cost: 20_554_228 },
                  { loadId: 1, siesaNumber: "1611129", orderNumber: "175830", kg: 8_360, cost: 16_428_730 },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("groups by supplier in the catalog order and by day, most recent day first", () => {
    const summary = buildLoadSummary([
      load(1, { supplier: "Contegral", date: "2026-11-18" as LoadRow["date"], lines: [line("A", "1", 1, 1)] }),
      load(2, { supplier: "Finca", date: "2026-11-18" as LoadRow["date"], lines: [line("B", "2", 1, 1)] }),
      load(3, { supplier: "Finca", date: "2026-11-20" as LoadRow["date"], lines: [line("C", "3", 1, 1)] }),
      load(4, { supplier: "Finca", date: "2026-11-20" as LoadRow["date"], lines: [line("D", "4", 1, 1)] }),
    ]);

    expect(summary.map((s) => s.supplier)).toEqual(["Finca", "Contegral"]);
    expect(summary[0].days.map((d) => [d.date, d.vehicles[0].rows.map((r) => r.loadId)])).toEqual([
      ["2026-11-20", [3, 4]],
      ["2026-11-18", [2]],
    ]);
  });

  it("rounds the kilos to whole numbers and leaves out loads without lines", () => {
    const summary = buildLoadSummary([load(1, { lines: [line("A", "1", 0.8, 1_663_662), line("A", "1", 0.0004, 0)] }), load(2, { lines: [] })]);

    expect(summary[0].days[0].vehicles[0].rows).toHaveLength(1);
    expect(summary[0].days[0].vehicles[0].rows[0].kg).toBe(800);
  });

  it("puts the loads of a day under one entry per plate, in order of first appearance", () => {
    const summary = buildLoadSummary([
      load(1, { plate: "TZR573", lines: [line("A", "1", 12.8, 100)] }),
      load(2, { plate: "H1K368", lines: [line("B", "2", 16, 200)] }),
      load(3, { plate: "TZR573", lines: [line("C", "3", 2, 50)] }),
    ]);

    expect(summary[0].days[0].vehicles.map((v) => [v.plate, v.rows.map((r) => r.siesaNumber), v.kg, v.cost])).toEqual([
      ["TZR573", ["A", "C"], 14_800, 150],
      ["H1K368", ["B"], 16_000, 200],
    ]);
  });
});

describe("buildLoadSummary with a free load", () => {
  it("includes the SIESA rows of a load without orders", () => {
    const summary = buildLoadSummary([
      load(7, { plate: "XYZ987", lines: [{ ...line("F-1", "P-9", 1.5, 3_000_000), orderId: null, referenceId: null }] }),
    ]);
    expect(summary[0]?.days[0]?.vehicles[0]).toEqual({
      plate: "XYZ987",
      kg: 1500,
      cost: 3_000_000,
      rows: [{ loadId: 7, siesaNumber: "F-1", orderNumber: "P-9", kg: 1500, cost: 3_000_000 }],
    });
  });
});
