import { describe, expect, it } from "vitest";
import { applyImportCotero, importCoteroIssues, importDateRange, resolveImportCotero } from "./import-cotero";
import { emptyDraft, type ReceiptDraft } from "./receipt-rules";
import type { CoteroProfileRow } from "./settlement-rows";

const draft = (over: Partial<ReceiptDraft> = {}): ReceiptDraft => ({ ...emptyDraft("2026-11-10"), ...over });

const profile = (over: Partial<CoteroProfileRow> = {}): CoteroProfileRow => ({
  key: "doc:1056507092",
  name: "Juan Pérez",
  document: "1056507092",
  paymentMethod: null,
  paymentAccount: null,
  ...over,
});

describe("resolveImportCotero", () => {
  it("is empty without receipts", () => {
    expect(resolveImportCotero([], [])).toEqual({ name: "", document: "", known: false });
  });

  it("takes the name of the first receipt and the cédula of the first one that has a valid one", () => {
    const result = resolveImportCotero(
      [draft({ coteroName: "Juan Perez", coteroDocument: "" }), draft({ coteroName: "Otro", coteroDocument: "1.056.507.092" })],
      [],
    );
    expect(result).toEqual({ name: "Juan Perez", document: "1056507092", known: false });
  });

  it("falls back to the first non-blank name when the first receipt has none", () => {
    const result = resolveImportCotero([draft({ coteroName: "  " }), draft({ coteroName: "  Juan   Perez " })], []);
    expect(result.name).toBe("Juan Perez");
  });

  it("ignores an invalid cédula", () => {
    const result = resolveImportCotero([draft({ coteroName: "Juan", coteroDocument: "12" }), draft({ coteroDocument: "9988776" })], []);
    expect(result.document).toBe("9988776");
  });

  it("uses the stored name of a known cotero (by document)", () => {
    const result = resolveImportCotero([draft({ coteroName: "Juan Perez", coteroDocument: "1056507092" })], [profile()]);
    expect(result).toEqual({ name: "Juan Pérez", document: "1056507092", known: true });
  });

  it("recognizes a profile by its doc: key when its document column is empty", () => {
    const result = resolveImportCotero([draft({ coteroName: "x", coteroDocument: "1056507092" })], [profile({ document: null })]);
    expect(result).toMatchObject({ name: "Juan Pérez", known: true });
  });

  it("does not take a profile without a matching cédula", () => {
    const result = resolveImportCotero([draft({ coteroName: "Juan Perez", coteroDocument: "" })], [profile()]);
    expect(result).toEqual({ name: "Juan Perez", document: "", known: false });
  });
});

describe("applyImportCotero", () => {
  it("overrides the name and cédula of the draft", () => {
    const result = applyImportCotero(draft({ coteroName: "Otro", coteroDocument: "111" }), { name: "Juan", document: "1056507092" });
    expect(result).toMatchObject({ coteroName: "Juan", coteroDocument: "1056507092" });
  });
});

describe("importCoteroIssues", () => {
  it("requires a name and accepts a blank cédula", () => {
    expect(importCoteroIssues({ name: " ", document: "" })).toEqual([{ field: "coteroName", kind: "missing" }]);
    expect(importCoteroIssues({ name: "Juan", document: "" })).toEqual([]);
  });

  it("flags an unreadable cédula", () => {
    expect(importCoteroIssues({ name: "Juan", document: "12" })).toEqual([{ field: "coteroDocument", kind: "invalid" }]);
  });
});

describe("importDateRange", () => {
  it("is the earliest and latest valid date", () => {
    expect(importDateRange([draft({ date: "2026-11-12" }), draft({ date: "2026-11-03" }), draft({ date: "" }), draft({ date: "2026-13-40" })])).toEqual({
      from: "2026-11-03",
      to: "2026-11-12",
    });
  });

  it("is a single day when all the dates are the same", () => {
    expect(importDateRange([draft({ date: "2026-11-03" })])).toEqual({ from: "2026-11-03", to: "2026-11-03" });
  });

  it("is null without valid dates", () => {
    expect(importDateRange([draft({ date: "" })])).toBeNull();
  });
});
