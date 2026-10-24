import { describe, expect, it } from "vitest";
import type { AttentionItem } from "@/modules/dashboard/domain/dashboard-metrics";
import { bucketByUrgency, describeDaysLeft, urgencyOf } from "./urgency";

function item(p: Partial<AttentionItem> & { plate: string }): AttentionItem {
  return {
    kind: "SOAT",
    status: "warning",
    daysLeft: 10,
    detail: "01/01/2027",
    ...p,
  };
}

describe("urgencyOf", () => {
  it("puts past dates in overdue", () => {
    expect(urgencyOf({ status: "expired", daysLeft: -1 })).toBe("overdue");
    expect(urgencyOf({ status: "expired", daysLeft: -400 })).toBe("overdue");
  });

  it("treats today through 7 days as this week", () => {
    expect(urgencyOf({ status: "warning", daysLeft: 0 })).toBe("week");
    expect(urgencyOf({ status: "warning", daysLeft: 7 })).toBe("week");
  });

  it("treats 8 days and beyond as the 30-day window", () => {
    expect(urgencyOf({ status: "warning", daysLeft: 8 })).toBe("month");
    expect(urgencyOf({ status: "warning", daysLeft: 30 })).toBe("month");
  });

  it("falls back to the status when there is no date", () => {
    expect(urgencyOf({ status: "expired", daysLeft: null })).toBe("overdue");
    expect(urgencyOf({ status: "warning", daysLeft: null })).toBe("month");
  });

  it("never lets an expired item hide in a later bucket", () => {
    expect(urgencyOf({ status: "expired", daysLeft: 3 })).toBe("overdue");
  });
});

describe("bucketByUrgency", () => {
  it("groups items and keeps the incoming order inside each bucket", () => {
    const items = [
      item({ plate: "AAA111", status: "expired", daysLeft: -9 }),
      item({ plate: "BBB222", status: "expired", daysLeft: null, kind: "TAX" }),
      item({ plate: "CCC333", daysLeft: 2 }),
      item({ plate: "DDD444", daysLeft: 7 }),
      item({ plate: "EEE555", daysLeft: 20 }),
      item({ plate: "FFF666", daysLeft: null, kind: "OIL" }),
    ];
    const out = bucketByUrgency(items);
    expect(out.overdue.map((i) => i.plate)).toEqual(["AAA111", "BBB222"]);
    expect(out.week.map((i) => i.plate)).toEqual(["CCC333", "DDD444"]);
    expect(out.month.map((i) => i.plate)).toEqual(["EEE555", "FFF666"]);
  });

  it("returns empty buckets for an empty list", () => {
    expect(bucketByUrgency([])).toEqual({ overdue: [], week: [], month: [] });
  });
});

describe("describeDaysLeft", () => {
  it("speaks in plain Spanish", () => {
    expect(describeDaysLeft(-1)).toBe("hace 1 día");
    expect(describeDaysLeft(-12)).toBe("hace 12 días");
    expect(describeDaysLeft(0)).toBe("hoy");
    expect(describeDaysLeft(1)).toBe("mañana");
    expect(describeDaysLeft(9)).toBe("en 9 días");
  });

  it("is empty when there is no date", () => {
    expect(describeDaysLeft(null)).toBe("");
  });
});
