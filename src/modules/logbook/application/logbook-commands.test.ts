import { describe, expect, it } from "vitest";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { createLogbookCommands } from "./logbook-commands";
import type { EntryKind, LogbookRepository, VehicleRef } from "./logbook-ports";

const TODAY = "2026-10-17";

/** In-memory fake: plates map to vehicles, entry ids map to the vehicle they belong to. */
function fakeRepo(vehicles: Record<string, VehicleRef>, entries: Record<string, number> = {}) {
  const calls: Array<{ op: string; args: unknown }> = [];
  const repo: LogbookRepository = {
    findVehicle: async (plate) => vehicles[plate] ?? null,
    findEntryVehicle: async (kind, id) => {
      const vehicleId = entries[`${kind}:${id}`];
      return Object.values(vehicles).find((v) => v.id === vehicleId) ?? null;
    },
    create: async (kind, vehicleId, values) => void calls.push({ op: "create", args: { kind, vehicleId, values } }),
    update: async (kind, id, values) => void calls.push({ op: "update", args: { kind, id, values } }),
    remove: async (kind, id) => void calls.push({ op: "remove", args: { kind, id } }),
  };
  return { repo, calls };
}

const active: VehicleRef = { id: 1, status: "ACTIVE" };
const sold: VehicleRef = { id: 2, status: "SOLD" };

const setup = () => {
  const { repo, calls } = fakeRepo({ "AAA-111": active, "BBB-222": sold }, { "service:7": 1, "tire:8": 2 });
  return { commands: createLogbookCommands(repo, () => TODAY), calls };
};

const service = {
  date: "2026-10-01",
  kind: "CORRECTIVE" as const,
  description: "Cambio de bomba",
  provider: "Taller",
  km: null,
  price: 100000,
  notes: null,
};

describe("create", () => {
  it("stores the record on the vehicle with the plate", async () => {
    const { commands, calls } = setup();
    const result = await commands.create("service", "AAA-111", service);
    expect(result.message).toBe("Servicio registrado.");
    expect(calls).toEqual([{ op: "create", args: { kind: "service", vehicleId: 1, values: service } }]);
  });

  it("has a message per kind", async () => {
    const { commands } = setup();
    expect((await commands.create("tire", "AAA-111", { date: TODAY, quantity: 2, reference: "x", provider: null, price: null, notes: null })).message).toBe(
      "Cambio de llantas registrado.",
    );
    expect((await commands.create("fuel", "AAA-111", { date: TODAY, gallons: 10, amount: 1000, provider: null })).message).toBe(
      "Tanqueo registrado.",
    );
  });

  it("rejects an unknown vehicle", async () => {
    const { commands, calls } = setup();
    await expect(commands.create("service", "ZZZ-999", service)).rejects.toThrow(/no existe/);
    expect(calls).toEqual([]);
  });

  it("rejects sold vehicles", async () => {
    const { commands } = setup();
    await expect(commands.create("service", "BBB-222", service)).rejects.toThrow(RuleError);
  });

  it("rejects a future date", async () => {
    const { commands } = setup();
    await expect(commands.create("service", "AAA-111", { ...service, date: "2026-10-18" })).rejects.toThrow(RuleError);
  });
});

describe("update", () => {
  it("rewrites the record", async () => {
    const { commands, calls } = setup();
    const result = await commands.update("service", 7, service);
    expect(result.message).toBe("Registro actualizado.");
    expect(calls).toEqual([{ op: "update", args: { kind: "service", id: 7, values: service } }]);
  });

  it("rejects a record that no longer exists", async () => {
    const { commands } = setup();
    await expect(commands.update("service", 99, service)).rejects.toThrow(/ya no existe/);
  });

  it("rejects records of sold vehicles", async () => {
    const { commands } = setup();
    await expect(
      commands.update("tire", 8, { date: TODAY, quantity: 2, reference: "x", provider: null, price: null, notes: null }),
    ).rejects.toThrow(RuleError);
  });

  it("rejects a future date", async () => {
    const { commands } = setup();
    await expect(commands.update("service", 7, { ...service, date: "2027-01-01" })).rejects.toThrow(RuleError);
  });
});

describe("remove", () => {
  it("deletes the record", async () => {
    const { commands, calls } = setup();
    const kind: EntryKind = "service";
    expect((await commands.remove(kind, 7)).message).toBe("Registro eliminado.");
    expect(calls).toEqual([{ op: "remove", args: { kind, id: 7 } }]);
  });

  it("rejects a record that no longer exists", async () => {
    const { commands } = setup();
    await expect(commands.remove("service", 99)).rejects.toThrow(/ya no existe/);
  });

  it("rejects records of sold vehicles", async () => {
    const { commands } = setup();
    await expect(commands.remove("tire", 8)).rejects.toThrow(RuleError);
  });
});
