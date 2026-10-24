import { describe, expect, it } from "vitest";
import type { AttentionItem } from "@/modules/dashboard/domain/dashboard-metrics";
import { countByKind, filterAlerts, parseKindParam, parseStatusParam, toggleStatus } from "./alert-filters";

function item(p: Partial<AttentionItem> & { plate: string }): AttentionItem {
  return {
    kind: "SOAT",
    status: "warning",
    daysLeft: 10,
    detail: "01/01/2027",
    ...p,
  };
}

const items = [
  item({ plate: "AAA111", status: "expired", daysLeft: -3 }),
  item({ plate: "AAA111", kind: "TAX", status: "expired", daysLeft: null }),
  item({ plate: "BBB222", kind: "TECNO", daysLeft: 5 }),
  item({ plate: "CCC333", kind: "OIL", daysLeft: null }),
];

describe("filterAlerts", () => {
  it("returns everything with the default filters", () => {
    expect(filterAlerts(items, { kind: "ALL", status: "ALL", query: "" })).toEqual(items);
  });

  it("filters by kind", () => {
    const out = filterAlerts(items, { kind: "TECNO", status: "ALL", query: "" });
    expect(out.map((i) => i.plate)).toEqual(["BBB222"]);
  });

  it("filters by status", () => {
    const out = filterAlerts(items, { kind: "ALL", status: "expired", query: "" });
    expect(out.map((i) => i.kind)).toEqual(["SOAT", "TAX"]);
  });

  it("matches the plate ignoring case, spaces and dashes", () => {
    const out = filterAlerts(items, { kind: "ALL", status: "ALL", query: " bbb-2 " });
    expect(out.map((i) => i.plate)).toEqual(["BBB222"]);
  });

  it("keeps the incoming order", () => {
    const out = filterAlerts(items, { kind: "ALL", status: "ALL", query: "aaa" });
    expect(out.map((i) => i.kind)).toEqual(["SOAT", "TAX"]);
  });
});

describe("countByKind", () => {
  it("counts every kind plus the total, zero when absent", () => {
    expect(countByKind(items)).toEqual({ ALL: 4, SOAT: 1, TECNO: 1, POLICY: 0, TAX: 1, OIL: 1 });
  });
});

describe("search params", () => {
  it("reads known kinds and falls back to ALL", () => {
    expect(parseKindParam("TAX")).toBe("TAX");
    expect(parseKindParam(["OIL", "SOAT"])).toBe("OIL");
    expect(parseKindParam("nope")).toBe("ALL");
    expect(parseKindParam(undefined)).toBe("ALL");
  });

  it("reads known statuses and falls back to ALL", () => {
    expect(parseStatusParam("expired")).toBe("expired");
    expect(parseStatusParam("warning")).toBe("warning");
    expect(parseStatusParam("ok")).toBe("ALL");
  });
});

describe("toggleStatus", () => {
  it("selects a status that is not active", () => {
    expect(toggleStatus("ALL", "expired")).toBe("expired");
    expect(toggleStatus("warning", "expired")).toBe("expired");
  });

  it("clears the filter when the active status is toggled again", () => {
    expect(toggleStatus("expired", "expired")).toBe("ALL");
    expect(toggleStatus("warning", "warning")).toBe("ALL");
  });
});
