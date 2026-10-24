import { describe, expect, it } from "vitest";
import {
  buildAttentionItems,
  computeKpis,
  filterByGroup,
  parseGroupParam,
  type DashboardRow,
} from "./dashboard-metrics";

const TODAY = "2026-06-15";

function r(p: Partial<DashboardRow> & { plate: string }): DashboardRow {
  return {
    className: "Camión",
    ownerName: "TRANSPORTES EL IMPERIO",
    ownerGroup: "IMPERIO",
    vehicleStatus: "ACTIVE",
    soat: { status: "ok", date: "2027-01-01" },
    tecno: { status: "ok", date: "2027-01-01" },
    policy: { status: "ok", date: "2027-01-01" },
    tax: { status: "ok", text: "2026" },
    nextChange: { status: "ok", text: "" },
    ...p,
  };
}

const plates = (list: Array<{ plate: string }>) => list.map((x) => x.plate);

describe("parseGroupParam", () => {
  it("accepts known groups and rejects anything else", () => {
    expect(parseGroupParam("IMPERIO")).toBe("IMPERIO");
    expect(parseGroupParam("PAEZ")).toBe("PAEZ");
    expect(parseGroupParam("THIRD_PARTY")).toBe("THIRD_PARTY");
    expect(parseGroupParam("nope")).toBeNull();
    expect(parseGroupParam("")).toBeNull();
    expect(parseGroupParam(undefined)).toBeNull();
    expect(parseGroupParam(["IMPERIO", "PAEZ"])).toBe("IMPERIO");
  });
});

describe("filterByGroup", () => {
  const rows = [
    r({ plate: "A" }),
    r({ plate: "B", ownerGroup: "PAEZ" }),
    r({ plate: "C", ownerGroup: null, ownerName: null }),
  ];
  it("returns everything without a group", () => {
    expect(plates(filterByGroup(rows, null))).toEqual(["A", "B", "C"]);
  });
  it("keeps only the chosen group", () => {
    expect(plates(filterByGroup(rows, "PAEZ"))).toEqual(["B"]);
  });
});

describe("computeKpis", () => {
  const rows = [
    r({ plate: "A" }),
    r({
      plate: "B",
      soat: { status: "expired", date: "2026-05-01" },
      tecno: { status: "expired", date: "2026-05-02" },
    }),
    r({ plate: "C", tax: { status: "warning", text: "2025" } }),
    r({ plate: "D", vehicleStatus: "IDLE" }),
    r({ plate: "E", vehicleStatus: "IN_WORKSHOP", nextChange: { status: "inactive", text: "En taller" } }),
    r({ plate: "F", vehicleStatus: "SOLD", soat: { status: "inactive", date: null } }),
  ];
  const k = computeKpis(rows, TODAY);

  it("counts expired and warning items and vehicles", () => {
    expect(k.expiredItems).toBe(2);
    expect(k.expiredVehicles).toBe(1);
    expect(k.warningItems).toBe(1);
    expect(k.warningVehicles).toBe(1);
  });
  it("ignores alert cells of sold vehicles", () => {
    const sold = computeKpis(
      [r({ plate: "Z", vehicleStatus: "SOLD", soat: { status: "expired", date: "2020-01-01" } })],
      TODAY,
    );
    expect(sold.expiredItems).toBe(0);
  });
});

describe("buildAttentionItems", () => {
  it("sorts expired first (most overdue first), then by days left, then undated", () => {
    const rows = [
      r({ plate: "W1", soat: { status: "warning", date: "2026-06-25" } }),
      r({ plate: "E1", tecno: { status: "expired", date: "2026-06-10" } }),
      r({ plate: "E2", soat: { status: "expired", date: "2026-05-01" } }),
      r({ plate: "W2", policy: { status: "warning", date: "2026-06-20" } }),
      r({ plate: "ND", soat: { status: "warning", date: null } }),
      r({ plate: "T1", tax: { status: "expired", text: "2024" } }),
    ];
    const items = buildAttentionItems(rows, TODAY);
    expect(items.map((i) => `${i.plate}:${i.kind}`)).toEqual([
      "E2:SOAT",
      "E1:TECNO",
      "T1:TAX",
      "W2:POLICY",
      "W1:SOAT",
      "ND:SOAT",
    ]);
    expect(items[0]).toMatchObject({ status: "expired", daysLeft: -45 });
    expect(items[3]).toMatchObject({ status: "warning", daysLeft: 5 });
    expect(items[5]).toMatchObject({ daysLeft: null, detail: "Sin dato" });
  });

  it("includes oil changes with their text and skips sold vehicles", () => {
    const rows = [
      r({ plate: "O", nextChange: { status: "warning", text: "12.000 km · 01/07/2026" } }),
      r({
        plate: "S",
        vehicleStatus: "SOLD",
        soat: { status: "expired", date: "2020-01-01" },
      }),
    ];
    const items = buildAttentionItems(rows, TODAY);
    expect(items).toEqual([
      { plate: "O", kind: "OIL", status: "warning", daysLeft: null, detail: "12.000 km · 01/07/2026" },
    ]);
  });

  it("formats the document date for display", () => {
    const [item] = buildAttentionItems(
      [r({ plate: "A", soat: { status: "warning", date: "2026-06-20" } })],
      TODAY,
    );
    expect(item.detail).toBe("20/06/2026");
  });
});
