import { describe, expect, it } from "vitest";
import {
  draftIssues,
  duplicateNumbers,
  filterReceipts,
  parseDraft,
  totalsOfReceipts,
  type ReceiptDraft,
  type ReceiptRow,
} from "./receipt-rules";

const TARIFFS = [{ validFrom: "2026-01-01", pricePerTon: 9800 }];

const draft = (over: Partial<ReceiptDraft> = {}): ReceiptDraft => ({
  receiptNumber: "T 0248",
  date: "2026-11-11",
  destination: "Finca La Esperanza",
  remissions: "44092 une 440493-440491",
  tons: "33.213",
  vehiclePlate: "abc 123",
  trailerPlate: "R 21396",
  coteroName: "  Juan   Perez ",
  coteroDocument: "1.056.507.092",
  driverName: "Pedro Gomez",
  amount: "$325'498",
  ...over,
});

describe("parseDraft", () => {
  it("normalizes every field of a complete draft", () => {
    const result = parseDraft(draft());
    expect(result.issues).toEqual([]);
    expect(result.values).toEqual({
      receiptNumber: "T-0248",
      date: "2026-11-11",
      destination: "Finca La Esperanza",
      remissions: ["44092", "440493-440491"],
      tons: 33.213,
      vehiclePlate: "ABC123",
      trailerPlate: "R21396",
      coteroName: "Juan Perez",
      coteroDocument: "1056507092",
      coteroKey: "doc:1056507092",
      driverName: "Pedro Gomez",
      amount: 325498,
    });
  });

  it("leaves the optional fields empty", () => {
    const result = parseDraft(draft({ remissions: "", trailerPlate: "", coteroDocument: "" }));
    expect(result.issues).toEqual([]);
    expect(result.values).toMatchObject({
      remissions: [],
      trailerPlate: null,
      coteroDocument: null,
      coteroKey: "name:juanperez",
    });
  });

  it("reports the required fields that are blank", () => {
    const result = parseDraft(
      draft({ receiptNumber: "", date: "", tons: "", vehiclePlate: "", coteroName: "", driverName: "", amount: "" }),
    );
    expect(result.values).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { field: "receiptNumber", kind: "missing" },
        { field: "date", kind: "missing" },
        { field: "tons", kind: "missing" },
        { field: "vehiclePlate", kind: "missing" },
        { field: "coteroName", kind: "missing" },
        { field: "driverName", kind: "missing" },
        { field: "amount", kind: "missing" },
      ]),
    );
  });

  it("does not require the destination", () => {
    const result = parseDraft(draft({ destination: "" }));
    expect(result.issues).toEqual([]);
    expect(result.values).toMatchObject({ destination: "" });
  });

  it("requires the driver", () => {
    const result = parseDraft(draft({ driverName: "  " }));
    expect(result.values).toBeNull();
    expect(result.issues).toEqual([{ field: "driverName", kind: "missing" }]);
  });

  it("reports text that cannot be read as a value", () => {
    const result = parseDraft(
      draft({ receiptNumber: "sin número", date: "11/11/2026", tons: "abc", amount: "mucho", coteroDocument: "12" }),
    );
    expect(result.values).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { field: "receiptNumber", kind: "invalid" },
        { field: "date", kind: "invalid" },
        { field: "tons", kind: "invalid" },
        { field: "amount", kind: "invalid" },
        { field: "coteroDocument", kind: "invalid" },
      ]),
    );
  });

  it("rejects dates that do not exist", () => {
    expect(parseDraft(draft({ date: "2026-02-30" })).issues).toContainEqual({ field: "date", kind: "invalid" });
  });

  it("reads kilograms as tons", () => {
    expect(parseDraft(draft({ tons: "12.880 Kg" })).values?.tons).toBe(12.88);
  });
});

describe("duplicateNumbers", () => {
  it("lists the numbers written more than once, ignoring blanks", () => {
    expect([...duplicateNumbers(["T-1", "T-2", "T-1", null, null])]).toEqual(["T-1"]);
    expect(duplicateNumbers([]).size).toBe(0);
  });
});

describe("draftIssues", () => {
  const none = new Set<string>();

  it("flags a number already in the database", () => {
    const result = draftIssues(draft(), { existingNumbers: new Set(["T-0248"]), batchDuplicates: none, tariffs: TARIFFS });
    expect(result.duplicate).toBe("database");
  });

  it("flags a number repeated in the same batch", () => {
    const result = draftIssues(draft(), { existingNumbers: none, batchDuplicates: new Set(["T-0248"]), tariffs: TARIFFS });
    expect(result.duplicate).toBe("batch");
  });

  it("flags an amount away from tons times tariff", () => {
    const high = draftIssues(draft({ amount: "$500.000" }), { existingNumbers: none, batchDuplicates: none, tariffs: TARIFFS });
    expect(high.mismatch).toBe(true);
    const fine = draftIssues(draft(), { existingNumbers: none, batchDuplicates: none, tariffs: TARIFFS });
    expect(fine.mismatch).toBe(false);
    expect(fine.duplicate).toBeNull();
    expect(fine.blocked).toBe(false);
  });

  it("blocks saving on missing fields and on duplicates, never on a mismatch alone", () => {
    expect(draftIssues(draft({ amount: "" }), { existingNumbers: none, batchDuplicates: none, tariffs: TARIFFS }).blocked).toBe(true);
    expect(draftIssues(draft(), { existingNumbers: new Set(["T-0248"]), batchDuplicates: none, tariffs: TARIFFS }).blocked).toBe(true);
    expect(draftIssues(draft({ amount: "$500.000" }), { existingNumbers: none, batchDuplicates: none, tariffs: TARIFFS }).blocked).toBe(false);
  });

  describe("against the fleet", () => {
    const fleet = {
      vehicles: [
        { id: 1, plate: "ABC-123", isTrailer: false },
        { id: 2, plate: "R-21396", isTrailer: true },
      ],
      drivers: [{ id: 1, name: "Pedro Gomez" }],
    };
    const context = { existingNumbers: none, batchDuplicates: none, tariffs: TARIFFS, fleet };

    it("passes names that are in the fleet", () => {
      const result = draftIssues(draft(), context);
      expect(result.issues).toEqual([]);
      expect(result.blocked).toBe(false);
    });

    it("blocks a plate, a trailer or a driver that is not in the fleet", () => {
      const result = draftIssues(draft({ vehiclePlate: "ZZZ-999", trailerPlate: "Q-00000", driverName: "Zoila" }), context);
      expect(result.issues).toEqual([
        { field: "vehiclePlate", kind: "not-in-fleet" },
        { field: "trailerPlate", kind: "not-in-fleet" },
        { field: "driverName", kind: "not-in-fleet" },
      ]);
      expect(result.blocked).toBe(true);
    });

    it("does not report twice a field that is missing", () => {
      const result = draftIssues(draft({ driverName: "" }), context);
      expect(result.issues).toEqual([{ field: "driverName", kind: "missing" }]);
    });
  });
});

const row = (over: Partial<ReceiptRow>): ReceiptRow => ({
  id: 1,
  receiptNumber: "T-1",
  date: "2026-11-01",
  destination: "Finca La Esperanza",
  remissions: [],
  tons: 10,
  vehiclePlate: "ABC123",
  trailerPlate: null,
  coteroKey: "doc:111111",
  coteroName: "Juan Perez",
  coteroDocument: "111111",
  driverName: "Pedro",
  amount: 98000,
  tariffPerTon: 9800,
  expectedAmount: 98000,
  amountMismatch: false,
  filePath: null,
  pageNumber: null,
  status: "pending",
  settlementId: null,
  settlementNumber: null,
  ...over,
});

describe("filterReceipts", () => {
  const rows = [
    row({ id: 1, date: "2026-11-01" }),
    row({ id: 2, date: "2026-11-10", coteroKey: "name:maria", coteroName: "Maria", status: "settled" }),
    row({ id: 3, date: "2026-11-20", vehiclePlate: "XYZ987", destination: "Hacienda El Roble", status: "paid" }),
  ];
  const all = { from: null, to: null, coteroKey: null, status: null, plate: "", destination: "" };

  it("keeps everything without filters", () => {
    expect(filterReceipts(rows, all)).toHaveLength(3);
  });

  it("filters by date range, inclusive", () => {
    expect(filterReceipts(rows, { ...all, from: "2026-11-10", to: "2026-11-20" }).map((r) => r.id)).toEqual([2, 3]);
    expect(filterReceipts(rows, { ...all, to: "2026-11-01" }).map((r) => r.id)).toEqual([1]);
  });

  it("filters by cotero key and by status", () => {
    expect(filterReceipts(rows, { ...all, coteroKey: "name:maria" }).map((r) => r.id)).toEqual([2]);
    expect(filterReceipts(rows, { ...all, status: "paid" }).map((r) => r.id)).toEqual([3]);
  });

  it("filters by plate ignoring the hyphen and the case", () => {
    expect(filterReceipts(rows, { ...all, plate: "xyz-987" }).map((r) => r.id)).toEqual([3]);
  });

  it("filters by destination ignoring accents and case", () => {
    expect(filterReceipts(rows, { ...all, destination: "hacienda el róble" }).map((r) => r.id)).toEqual([3]);
  });
});

describe("totalsOfReceipts", () => {
  it("adds the count, the tons and the amount", () => {
    const totals = totalsOfReceipts([row({ tons: 10.5, amount: 100 }), row({ tons: 0.25, amount: 50 })]);
    expect(totals).toEqual({ count: 2, tons: 10.75, amount: 150 });
  });

  it("is zero without receipts", () => {
    expect(totalsOfReceipts([])).toEqual({ count: 0, tons: 0, amount: 0 });
  });
});
