import { describe, expect, it } from "vitest";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { planOilChange } from "./plan-oil-change";

const TODAY = "2026-10-17";
const vehicle = { odometerWorking: true, currentKm: 100000, oilMode: "both" as const };
const interval = { months: 2, km: 20000 };

describe("planOilChange", () => {
  it("computes next date and km from the interval", () => {
    const plan = planOilChange({ date: "2026-10-01", km: 105000, today: TODAY, vehicle, interval });
    expect(plan).toMatchObject({
      nextDate: "2026-12-01",
      nextKm: 125000,
      intervalMonths: 2,
      intervalKm: 20000,
      newCurrentKm: 105000,
    });
  });

  it("does not move current km backwards", () => {
    const plan = planOilChange({ date: "2026-10-01", km: 90000, today: TODAY, vehicle, interval });
    expect(plan.newCurrentKm).toBeNull();
  });

  it("sets current km when the vehicle had none", () => {
    const plan = planOilChange({
      date: "2026-10-01",
      km: 500,
      today: TODAY,
      vehicle: { ...vehicle, currentKm: null },
      interval,
    });
    expect(plan.newCurrentKm).toBe(500);
  });

  it("requires km when the odometer works", () => {
    expect(() =>
      planOilChange({ date: "2026-10-01", km: null, today: TODAY, vehicle, interval }),
    ).toThrow(RuleError);
  });

  it("allows no km when the odometer is broken and only uses the date", () => {
    const plan = planOilChange({
      date: "2026-10-01",
      km: null,
      today: TODAY,
      vehicle: { ...vehicle, odometerWorking: false },
      interval,
    });
    expect(plan).toMatchObject({ nextDate: "2026-12-01", nextKm: null, newCurrentKm: null });
  });

  it("respects the vehicle oil mode", () => {
    const plan = planOilChange({
      date: "2026-10-01",
      km: 105000,
      today: TODAY,
      vehicle: { ...vehicle, oilMode: "km" },
      interval,
    });
    expect(plan).toMatchObject({ nextDate: null, nextKm: 125000 });
  });

  it("uses an overridden interval", () => {
    const plan = planOilChange({
      date: "2026-10-01",
      km: 105000,
      today: TODAY,
      vehicle,
      interval: { months: 3, km: 10000 },
    });
    expect(plan).toMatchObject({ nextDate: "2027-01-01", nextKm: 115000 });
  });

  it("rejects future dates", () => {
    expect(() =>
      planOilChange({ date: "2026-11-01", km: 1, today: TODAY, vehicle, interval }),
    ).toThrow(RuleError);
  });
});
