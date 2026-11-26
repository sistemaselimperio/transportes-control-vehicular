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
            loads: [
              {
                loadId: 1,
                plate: "J51978",
                rows: [
                  { siesaNumber: "1611117", orderNumber: "175826", kg: 10_520, cost: 20_554_228 },
                  { siesaNumber: "1611129", orderNumber: "175830", kg: 8_360, cost: 16_428_730 },
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
    expect(summary[0].days.map((d) => [d.date, d.loads.map((l) => l.loadId)])).toEqual([
      ["2026-11-20", [3, 4]],
      ["2026-11-18", [2]],
    ]);
  });

  it("rounds the kilos to whole numbers and leaves out loads without lines", () => {
    const summary = buildLoadSummary([load(1, { lines: [line("A", "1", 0.8, 1_663_662), line("A", "1", 0.0004, 0)] }), load(2, { lines: [] })]);

    expect(summary[0].days[0].loads).toHaveLength(1);
    expect(summary[0].days[0].loads[0].rows[0].kg).toBe(800);
  });
});
