import { describe, expect, it } from "vitest";
import { createVehicleCommands } from "./vehicle-commands";
import type { VehicleCommandRepository, VehicleSnapshot, VehicleUpdate } from "./vehicle-ports";
import { RuleError } from "../domain/vehicle-rules";

const base: Omit<VehicleSnapshot, "id" | "plate"> = {
  status: "ACTIVE",
  odometerWorking: true,
  currentKm: 1000,
  oilMode: "both",
  oilInterval: { months: 2, km: 10000 },
  ownership: null,
  assignment: null,
};
const truck: VehicleSnapshot = { ...base, id: 1, plate: "ABC-123" };
const tractor: VehicleSnapshot = { ...base, id: 5, plate: "TRC-500" };

function setup(existing: VehicleSnapshot[] = [truck, tractor]) {
  const updates: Array<{ id: number; fields: VehicleUpdate }> = [];
  const repo = {
    findByPlates: async (plates: string[]) => existing.filter((v) => plates.includes(v.plate)),
    findClass: async (id: number) =>
      id === 2 ? { id: 2, oilIntervalMonths: null, oilIntervalKm: null } : null,
    updateVehicle: async (id: number, fields: VehicleUpdate) => void updates.push({ id, fields }),
  } as unknown as VehicleCommandRepository;
  return { commands: createVehicleCommands(repo, () => "2026-10-17"), updates };
}

describe("updateVehicle", () => {
  it("updates only the given fields and returns the new plate", async () => {
    const { commands, updates } = setup();
    const result = await commands.updateVehicle("ABC-123", {
      plate: "xyz 987",
      brandLine: "Hino 300",
      classId: 2,
    });
    expect(result.plate).toBe("XYZ-987");
    expect(updates).toEqual([
      { id: 1, fields: { plate: "XYZ-987", brandLine: "Hino 300", classId: 2 } },
    ]);
  });

  it("keeps the plate when it does not change", async () => {
    const { commands, updates } = setup();
    await commands.updateVehicle("ABC-123", { plate: "abc123", notes: null });
    expect(updates[0].fields).toEqual({ plate: "ABC-123", notes: null });
  });

  it("rejects a plate used by another vehicle", async () => {
    const { commands, updates } = setup();
    await expect(commands.updateVehicle("ABC-123", { plate: "TRC500" })).rejects.toThrow(RuleError);
    expect(updates).toEqual([]);
  });

  it("rejects an unknown class, a sold vehicle and an unknown plate", async () => {
    await expect(setup().commands.updateVehicle("ABC-123", { classId: 9 })).rejects.toThrow(RuleError);
    await expect(
      setup([{ ...truck, status: "SOLD" }]).commands.updateVehicle("ABC-123", { notes: "x" }),
    ).rejects.toThrow(RuleError);
    await expect(setup().commands.updateVehicle("ZZZ-999", { notes: "x" })).rejects.toThrow(RuleError);
  });

  it("links and unlinks the towing vehicle, never to itself", async () => {
    const { commands, updates } = setup();
    await commands.updateVehicle("ABC-123", { towingPlate: "trc500" });
    await commands.updateVehicle("ABC-123", { towingPlate: null });
    expect(updates.map((u) => u.fields)).toEqual([{ towingVehicleId: 5 }, { towingVehicleId: null }]);
    await expect(commands.updateVehicle("ABC-123", { towingPlate: "ABC-123" })).rejects.toThrow(
      RuleError,
    );
  });
});
