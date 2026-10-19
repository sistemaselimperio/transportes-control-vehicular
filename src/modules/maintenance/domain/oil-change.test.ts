import { describe, expect, it } from "vitest";
import { nextOilChange, oilChangeStatus } from "./oil-change";

const today = "2026-06-15";
const interval = { months: 3, km: 5000 };

describe("nextOilChange", () => {
  const last = { date: "2026-01-31", km: 100000 };
  it("computes both next date and km in both mode", () => {
    expect(nextOilChange({ last, interval, mode: "both" })).toEqual({
      nextDate: "2026-04-30",
      nextKm: 105000,
    });
  });
  it("computes only the date in date mode", () => {
    expect(nextOilChange({ last, interval, mode: "date" })).toEqual({
      nextDate: "2026-04-30",
      nextKm: null,
    });
  });
  it("computes only the km in km mode", () => {
    expect(nextOilChange({ last, interval, mode: "km" })).toEqual({
      nextDate: null,
      nextKm: 105000,
    });
  });
  it("has no next km when the last change has no km", () => {
    expect(
      nextOilChange({
        last: { date: "2026-01-31", km: null },
        interval,
        mode: "both",
      }).nextKm,
    ).toBeNull();
  });
  it("has no next values when the class has no interval", () => {
    expect(
      nextOilChange({
        last,
        interval: { months: null, km: null },
        mode: "both",
      }),
    ).toEqual({ nextDate: null, nextKm: null });
  });
});

describe("oilChangeStatus", () => {
  const base = {
    vehicleStatus: "ACTIVE" as const,
    odometerWorking: true,
    currentKm: 101000 as number | null,
    last: { date: "2026-05-15", km: 100000 } as {
      date: string;
      km: number | null;
    } | null,
    interval,
    mode: "both" as const,
    today,
  };

  it("is inactive for IDLE, IN_WORKSHOP and SOLD vehicles", () => {
    for (const vehicleStatus of ["IDLE", "IN_WORKSHOP", "SOLD"] as const) {
      expect(oilChangeStatus({ ...base, vehicleStatus })).toBe("inactive");
    }
  });
  it("is not_applicable when the class has no oil interval", () => {
    expect(
      oilChangeStatus({ ...base, interval: { months: null, km: null } }),
    ).toBe("not_applicable");
  });
  it("is warning when there is no oil change on record", () => {
    expect(oilChangeStatus({ ...base, last: null })).toBe("warning");
  });
  it("is ok when both date and km are far", () => {
    expect(oilChangeStatus(base)).toBe("ok");
  });
  it("is expired when the date is past even if km is fine", () => {
    expect(
      oilChangeStatus({ ...base, last: { date: "2026-01-01", km: 100000 } }),
    ).toBe("expired");
  });
  it("is warning when the date is within 30 days", () => {
    expect(
      oilChangeStatus({ ...base, last: { date: "2026-03-20", km: 100000 } }),
    ).toBe("warning");
  });
  it("is warning when 500 km or fewer remain", () => {
    expect(oilChangeStatus({ ...base, currentKm: 104500 })).toBe("warning");
  });
  it("is ok when 501 km remain", () => {
    expect(oilChangeStatus({ ...base, currentKm: 104499 })).toBe("ok");
  });
  it("is expired when the km has been reached", () => {
    expect(oilChangeStatus({ ...base, currentKm: 105000 })).toBe("expired");
  });
  it("takes whichever comes first in both mode", () => {
    expect(oilChangeStatus({ ...base, currentKm: 106000 })).toBe("expired");
  });
  it("ignores km in date mode", () => {
    expect(
      oilChangeStatus({ ...base, mode: "date", currentKm: 999999 }),
    ).toBe("ok");
  });
  it("ignores km when the odometer does not work", () => {
    expect(
      oilChangeStatus({ ...base, odometerWorking: false, currentKm: 999999 }),
    ).toBe("ok");
  });
  it("ignores km when the current km is unknown", () => {
    expect(oilChangeStatus({ ...base, currentKm: null })).toBe("ok");
  });
  it("is warning when nothing can be evaluated (km mode, no current km)", () => {
    expect(oilChangeStatus({ ...base, mode: "km", currentKm: null })).toBe(
      "warning",
    );
  });
});
