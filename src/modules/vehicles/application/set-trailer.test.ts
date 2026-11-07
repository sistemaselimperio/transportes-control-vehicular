import { describe, expect, it } from "vitest";
import { createVehicleCommands } from "./vehicle-commands";
import type { VehicleCommandRepository, VehicleSnapshot } from "./vehicle-ports";
import { RuleError } from "../domain/vehicle-rules";

const base: Omit<VehicleSnapshot, "id" | "plate"> = {
  status: "ACTIVE",
  isTrailer: false,
  odometerWorking: true,
  currentKm: 1000,
  oilMode: "both",
  oilInterval: { months: 2, km: 10000 },
  ownership: null,
  assignment: null,
};
const tractor: VehicleSnapshot = { ...base, id: 5, plate: "TRC-500" };
const trailer: VehicleSnapshot = { ...base, id: 7, plate: "S88490", isTrailer: true };

function setup(existing: VehicleSnapshot[] = [tractor, trailer]) {
  const calls: Array<{ tractorId: number; trailerId: number | null }> = [];
  const repo = {
    findByPlates: async (plates: string[]) => existing.filter((v) => plates.includes(v.plate)),
    setTrailer: async (tractorId: number, trailerId: number | null) =>
      void calls.push({ tractorId, trailerId }),
  } as unknown as VehicleCommandRepository;
  return { commands: createVehicleCommands(repo, () => "2026-10-17"), calls };
}

describe("setTrailer", () => {
  it("anchors the trailer to the tractor", async () => {
    const { commands, calls } = setup();
    const result = await commands.setTrailer("trc500", "s88490");
    expect(calls).toEqual([{ tractorId: 5, trailerId: 7 }]);
    expect(result.message).toBe("Remolque S88490 anclado a TRC-500.");
  });

  it("clears the trailer when none is given", async () => {
    const { commands, calls } = setup();
    const result = await commands.setTrailer("TRC-500", null);
    expect(calls).toEqual([{ tractorId: 5, trailerId: null }]);
    expect(result.message).toBe("TRC-500 quedó sin remolque.");
  });

  it("rejects an idle or sold trailer without writing", async () => {
    for (const status of ["IDLE", "SOLD"] as const) {
      const { commands, calls } = setup([tractor, { ...trailer, status }]);
      await expect(commands.setTrailer("TRC-500", "S88490")).rejects.toThrow(RuleError);
      expect(calls).toEqual([]);
    }
  });

  it("rejects a vehicle that is not a trailer, a trailer as tractor and unknown plates", async () => {
    const other: VehicleSnapshot = { ...base, id: 9, plate: "ABC-123" };
    await expect(setup([tractor, other]).commands.setTrailer("TRC-500", "ABC-123")).rejects.toThrow(
      "no es un remolque",
    );
    await expect(setup().commands.setTrailer("S88490", "S88490")).rejects.toThrow(RuleError);
    await expect(setup().commands.setTrailer("ZZZ-999", "S88490")).rejects.toThrow(RuleError);
    await expect(setup().commands.setTrailer("TRC-500", "R00000")).rejects.toThrow(RuleError);
  });

  it("rejects changes on a sold tractor", async () => {
    const { commands, calls } = setup([{ ...tractor, status: "SOLD" }, trailer]);
    await expect(commands.setTrailer("TRC-500", "S88490")).rejects.toThrow(RuleError);
    await expect(commands.setTrailer("TRC-500", null)).rejects.toThrow(RuleError);
    expect(calls).toEqual([]);
  });
});
