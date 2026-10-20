import { describe, expect, it } from "vitest";
import {
  buildAttentionItems,
  computeKpis,
  filterByGroup,
  fleetByClass,
  fleetByGroup,
  migrationProgress,
  parseGroupParam,
  pendingOilChanges,
  soldByYear,
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
    soldOn: null,
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
    r({
      plate: "F",
      vehicleStatus: "SOLD",
      soldOn: "2026-02-01",
      soat: { status: "inactive", date: null },
    }),
    r({ plate: "G", vehicleStatus: "SOLD", soldOn: "2025-02-01" }),
    r({ plate: "H", vehicleStatus: "SOLD", soldOn: null }),
  ];
  const k = computeKpis(rows, TODAY);

  it("counts fleet by status excluding sold", () => {
    expect(k.activeFleet).toBe(3);
    expect(k.fleetTotal).toBe(5);
    expect(k.idle).toBe(1);
    expect(k.inWorkshop).toBe(1);
  });
  it("counts expired and warning items and vehicles", () => {
    expect(k.expiredItems).toBe(2);
    expect(k.expiredVehicles).toBe(1);
    expect(k.warningItems).toBe(1);
    expect(k.warningVehicles).toBe(1);
  });
  it("counts vehicles sold in the current year only", () => {
    expect(k.soldThisYear).toBe(1);
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

describe("fleetByClass", () => {
  it("groups non-sold vehicles by class, largest first then alphabetical", () => {
    const rows = [
      r({ plate: "1", className: "Camión" }),
      r({ plate: "2", className: "Camión" }),
      r({ plate: "3", className: "Remolque" }),
      r({ plate: "4", className: "Camioneta" }),
      r({ plate: "5", className: "Remolque", vehicleStatus: "SOLD" }),
    ];
    expect(fleetByClass(rows)).toEqual([
      { name: "Camión", count: 2 },
      { name: "Camioneta", count: 1 },
      { name: "Remolque", count: 1 },
    ]);
  });
});

describe("fleetByGroup", () => {
  it("counts non-sold vehicles per owner group with a no-owner bucket", () => {
    const rows = [
      r({ plate: "1" }),
      r({ plate: "2" }),
      r({ plate: "3", ownerGroup: "PAEZ" }),
      r({ plate: "4", ownerGroup: null, ownerName: null }),
      r({ plate: "5", ownerGroup: "THIRD_PARTY", vehicleStatus: "SOLD" }),
    ];
    expect(fleetByGroup(rows)).toEqual([
      { group: "IMPERIO", label: "Transportes El Imperio", count: 2 },
      { group: "PAEZ", label: "Fabián Páez", count: 1 },
      { group: "NONE", label: "Sin propietario", count: 1 },
    ]);
  });
});

describe("migrationProgress", () => {
  it("computes the share owned by IMPERIO and counts per owner", () => {
    const rows = [
      r({ plate: "1" }),
      r({ plate: "2", ownerGroup: "PAEZ", ownerName: "FABIÁN PÁEZ" }),
      r({ plate: "3", ownerGroup: "PAEZ", ownerName: "FABIÁN PÁEZ" }),
      r({ plate: "4", ownerGroup: "PAEZ", ownerName: "SANDRA PÁEZ" }),
      r({ plate: "5", ownerGroup: "THIRD_PARTY", ownerName: "BANCO" }),
      r({ plate: "6", vehicleStatus: "SOLD", ownerGroup: "PAEZ", ownerName: "FABIÁN PÁEZ" }),
    ];
    const m = migrationProgress(rows);
    expect(m.total).toBe(5);
    expect(m.imperio).toBe(1);
    expect(m.percent).toBe(20);
    expect(m.byOwner).toEqual([
      { ownerName: "FABIÁN PÁEZ", group: "PAEZ", count: 2 },
      { ownerName: "BANCO", group: "THIRD_PARTY", count: 1 },
      { ownerName: "SANDRA PÁEZ", group: "PAEZ", count: 1 },
      { ownerName: "TRANSPORTES EL IMPERIO", group: "IMPERIO", count: 1 },
    ]);
  });
  it("is 0% for an empty fleet", () => {
    expect(migrationProgress([])).toMatchObject({ total: 0, percent: 0, byOwner: [] });
  });
  it("labels vehicles without owner", () => {
    const m = migrationProgress([r({ plate: "1", ownerGroup: null, ownerName: null })]);
    expect(m.byOwner).toEqual([{ ownerName: "Sin propietario", group: null, count: 1 }]);
  });
});

describe("pendingOilChanges", () => {
  it("lists overdue first, then due soon, and ignores other statuses", () => {
    const rows = [
      r({ plate: "B", nextChange: { status: "warning", text: "x" } }),
      r({ plate: "A", nextChange: { status: "expired", text: "y" } }),
      r({ plate: "C" }),
      r({ plate: "D", nextChange: { status: "inactive", text: "Quieta" }, vehicleStatus: "IDLE" }),
    ];
    const p = pendingOilChanges(rows);
    expect(plates(p.overdue)).toEqual(["A"]);
    expect(plates(p.dueSoon)).toEqual(["B"]);
  });
});

describe("soldByYear", () => {
  it("counts sold vehicles per year ascending, undated last", () => {
    const rows = [
      r({ plate: "1", vehicleStatus: "SOLD", soldOn: "2025-03-01" }),
      r({ plate: "2", vehicleStatus: "SOLD", soldOn: "2024-03-01" }),
      r({ plate: "3", vehicleStatus: "SOLD", soldOn: "2025-09-01" }),
      r({ plate: "4", vehicleStatus: "SOLD", soldOn: null }),
      r({ plate: "5" }),
    ];
    expect(soldByYear(rows)).toEqual([
      { year: "2024", count: 1 },
      { year: "2025", count: 2 },
      { year: "Sin fecha", count: 1 },
    ]);
  });
});
