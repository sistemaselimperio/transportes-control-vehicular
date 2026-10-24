import { describe, expect, it } from "vitest";
import type { AttentionItem } from "@/modules/dashboard/domain/dashboard-metrics";
import { groupVehicles } from "./vehicle-queue";

function item(p: Partial<AttentionItem> & { plate: string }): AttentionItem {
  return { kind: "SOAT", status: "warning", daysLeft: 10, detail: "01/01/2027", ...p };
}

const none = { kind: "ALL", status: "ALL", query: "" } as const;

describe("groupVehicles", () => {
  it("lists a vehicle once, in its most urgent group, with all its chips", () => {
    const items = [
      item({ plate: "AAA111", kind: "TECNO", daysLeft: 4 }),
      item({ plate: "AAA111", kind: "SOAT", status: "expired", daysLeft: -3 }),
    ];
    const out = groupVehicles(items, none);
    expect(out).toHaveLength(1);
    expect(out[0].urgency).toBe("overdue");
    expect(out[0].vehicles).toHaveLength(1);
    expect(out[0].vehicles[0].plate).toBe("AAA111");
    expect(out[0].vehicles[0].items.map((i) => i.kind)).toEqual(["SOAT", "TECNO"]);
  });

  it("keeps only the matching chips (and vehicles) when filtering by kind", () => {
    const items = [
      item({ plate: "AAA111", kind: "SOAT", status: "expired", daysLeft: -3 }),
      item({ plate: "AAA111", kind: "TECNO", daysLeft: 4 }),
      item({ plate: "BBB222", kind: "POLICY", daysLeft: 20 }),
    ];
    const out = groupVehicles(items, { ...none, kind: "TECNO" });
    expect(out.map((g) => g.urgency)).toEqual(["week"]);
    expect(out[0].vehicles.map((v) => [v.plate, v.items.map((i) => i.kind)])).toEqual([
      ["AAA111", ["TECNO"]],
    ]);
  });

  it("finds plates without case, spaces or dashes", () => {
    const items = [item({ plate: "ABC123" }), item({ plate: "XYZ999" })];
    const out = groupVehicles(items, { ...none, query: "abc-12" });
    expect(out.flatMap((g) => g.vehicles.map((v) => v.plate))).toEqual(["ABC123"]);
  });

  it("drops empty groups and returns nothing when no item matches", () => {
    const items = [item({ plate: "AAA111", daysLeft: 20 })];
    expect(groupVehicles(items, none).map((g) => g.urgency)).toEqual(["month"]);
    expect(groupVehicles(items, { ...none, query: "zzz" })).toEqual([]);
  });

  it("orders groups by urgency and vehicles inside a group by their most urgent item", () => {
    const items = [
      item({ plate: "CCC333", daysLeft: 6 }),
      item({ plate: "BBB222", daysLeft: 2 }),
      item({ plate: "DDD444", status: "expired", daysLeft: -1 }),
      item({ plate: "AAA111", daysLeft: 25 }),
    ];
    const out = groupVehicles(items, none);
    expect(out.map((g) => g.urgency)).toEqual(["overdue", "week", "month"]);
    expect(out[1].vehicles.map((v) => v.plate)).toEqual(["BBB222", "CCC333"]);
  });
});
