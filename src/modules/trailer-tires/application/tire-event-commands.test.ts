import { describe, expect, it } from "vitest";
import type { TireEventValues } from "../domain/tire-events";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { createTireEventCommands } from "./tire-event-commands";
import type { TireEventRepository, TrailerRef } from "./tire-event-ports";

const TODAY = "2026-10-17";

function fakeRepo(vehicles: Record<string, TrailerRef>, events: Record<number, number> = {}) {
  const calls: Array<{ op: string; args: unknown }> = [];
  const repo: TireEventRepository = {
    findVehicle: async (plate) => vehicles[plate] ?? null,
    findEventVehicle: async (id) => Object.values(vehicles).find((v) => v.id === events[id]) ?? null,
    create: async (vehicleId, values) => void calls.push({ op: "create", args: { vehicleId, values } }),
    update: async (id, values) => void calls.push({ op: "update", args: { id, values } }),
    remove: async (id) => void calls.push({ op: "remove", args: { id } }),
  };
  return { repo, calls };
}

const trailer: TrailerRef = { id: 1, status: "ACTIVE", isTrailer: true };
const truck: TrailerRef = { id: 2, status: "ACTIVE", isTrailer: false };
const soldTrailer: TrailerRef = { id: 3, status: "SOLD", isTrailer: true };

const setup = () => {
  const { repo, calls } = fakeRepo({ "R-001": trailer, "T-002": truck, "R-003": soldTrailer }, { 7: 1, 8: 3, 9: 2 });
  return { commands: createTireEventCommands(repo, () => TODAY), calls };
};

const change: TireEventValues = {
  type: "CHANGE",
  date: "2026-10-01",
  position: "E1-I-EXT",
  reference: "295/80R22.5",
  provider: "Llantas SA",
  price: 900000,
  notes: null,
};

describe("create", () => {
  it("stores the event on the trailer found by plate", async () => {
    const { commands, calls } = setup();
    const result = await commands.create("R-001", change);
    expect(result.message).toBe("Cambio de llanta registrado.");
    expect(calls).toEqual([{ op: "create", args: { vehicleId: 1, values: change } }]);
  });

  it("has a message per event type", async () => {
    const { commands } = setup();
    const base = { date: TODAY, position: "E1-I-EXT" as const };
    expect((await commands.create("R-001", { ...base, type: "REPAIR", provider: null, price: null, notes: "Parche" })).message).toBe(
      "Reparación registrada.",
    );
    expect((await commands.create("R-001", { ...base, type: "ROTATION", counterpart: "E2-I-EXT" })).message).toBe(
      "Rotación registrada.",
    );
    expect(
      (await commands.create("R-001", { ...base, type: "INSPECTION", treadDepthMm: 9, pressurePsi: null, condition: null })).message,
    ).toBe("Inspección registrada.");
  });

  it("rejects a vehicle that is not a trailer", async () => {
    const { commands, calls } = setup();
    await expect(commands.create("T-002", change)).rejects.toThrow(/remolques/);
    expect(calls).toEqual([]);
  });

  it("rejects an unknown vehicle", async () => {
    const { commands } = setup();
    await expect(commands.create("ZZZ-999", change)).rejects.toThrow(/no existe/);
  });

  it("rejects a sold trailer", async () => {
    const { commands } = setup();
    await expect(commands.create("R-003", change)).rejects.toThrow(RuleError);
  });

  it("rejects a future date", async () => {
    const { commands } = setup();
    await expect(commands.create("R-001", { ...change, date: "2026-10-18" })).rejects.toThrow(RuleError);
  });

  it("rejects an invalid event without storing it", async () => {
    const { commands, calls } = setup();
    await expect(
      commands.create("R-001", { type: "ROTATION", date: TODAY, position: "E1-I-EXT", counterpart: "E1-I-EXT" }),
    ).rejects.toThrow(/distintas/);
    expect(calls).toEqual([]);
  });
});

describe("update", () => {
  it("rewrites the event", async () => {
    const { commands, calls } = setup();
    const result = await commands.update(7, change);
    expect(result.message).toBe("Registro actualizado.");
    expect(calls).toEqual([{ op: "update", args: { id: 7, values: change } }]);
  });

  it("rejects an event that no longer exists", async () => {
    const { commands } = setup();
    await expect(commands.update(99, change)).rejects.toThrow(/ya no existe/);
  });

  it("rejects events of sold trailers", async () => {
    const { commands } = setup();
    await expect(commands.update(8, change)).rejects.toThrow(RuleError);
  });

  it("rejects an event that does not belong to a trailer", async () => {
    const { commands } = setup();
    await expect(commands.update(9, change)).rejects.toThrow(/remolques/);
  });

  it("rejects a future date and invalid values", async () => {
    const { commands } = setup();
    await expect(commands.update(7, { ...change, date: "2027-01-01" })).rejects.toThrow(RuleError);
    await expect(commands.update(7, { ...change, reference: " " })).rejects.toThrow(/referencia/);
  });
});

describe("remove", () => {
  it("deletes the event", async () => {
    const { commands, calls } = setup();
    expect((await commands.remove(7)).message).toBe("Registro eliminado.");
    expect(calls).toEqual([{ op: "remove", args: { id: 7 } }]);
  });

  it("rejects an event that no longer exists", async () => {
    const { commands } = setup();
    await expect(commands.remove(99)).rejects.toThrow(/ya no existe/);
  });

  it("rejects events of sold trailers", async () => {
    const { commands } = setup();
    await expect(commands.remove(8)).rejects.toThrow(RuleError);
  });
});
