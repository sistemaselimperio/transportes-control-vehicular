import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/permissions";
import { TurnError, type TurnActor } from "../domain/turn-rules";
import { createTurnCommands, type TurnDayRecord, type TurnPorts, type TurnRecord } from "./turn-commands";

const OPEN = new Date("2026-11-27T15:00:00Z");
const BEFORE = new Date("2026-11-27T11:00:00Z");
const AFTER = new Date("2026-11-27T23:00:00Z");

const admin: TurnActor = { userId: "admin", canAdmin: true, canEnturn: false };
const enturner: TurnActor = { userId: "e1", canAdmin: false, canEnturn: true };
const nobody: TurnActor = { userId: "x", canAdmin: false, canEnturn: false };

const DAY: TurnDayRecord = {
  id: 1,
  date: "2026-11-27",
  opensAt: new Date("2026-11-27T12:00:00Z"),
  closesAt: new Date("2026-11-27T22:00:00Z"),
};

const turn = (over: Partial<TurnRecord> & { id: number }): TurnRecord => ({
  turnDayId: 1,
  vehicleId: null,
  product: "Cemento",
  destination: "Finca",
  neededAt: new Date("2026-11-27T13:00:00Z"),
  createdBy: "e1",
  createdByName: "Rocío",
  ...over,
});

function fakePorts(seed: { days?: TurnDayRecord[]; turns?: TurnRecord[]; vehicles?: Record<number, string> } = {}) {
  const days = [...(seed.days ?? [DAY])];
  const turns = [...(seed.turns ?? [])];
  const vehicles = seed.vehicles ?? { 5: "ACTIVE", 6: "IDLE" };
  const calls = {
    insertedDays: [] as unknown[],
    windows: [] as unknown[],
    inserted: [] as unknown[],
    updated: [] as unknown[],
    assigned: [] as unknown[],
    cancelled: [] as unknown[],
    deleted: [] as unknown[],
  };
  const ports: TurnPorts = {
    findDayByDate: async (date) => days.find((d) => d.date === date) ?? null,
    findDay: async (id) => days.find((d) => d.id === id) ?? null,
    insertDay: async (input) => {
      calls.insertedDays.push(input);
      return { id: 99, date: input.date, opensAt: input.opensAt, closesAt: input.closesAt };
    },
    updateDayWindow: async (id, opensAt, closesAt) => void calls.windows.push({ id, opensAt, closesAt }),
    findVehicle: async (id) => (id in vehicles ? { id, status: vehicles[id] } : null),
    listActiveTurns: async (dayId) => turns.filter((t) => t.turnDayId === dayId),
    findTurn: async (id) => turns.find((t) => t.id === id) ?? null,
    insertTurn: async (input) => void calls.inserted.push(input),
    updateTurn: async (id, fields) => void calls.updated.push({ id, ...fields }),
    assignVehicle: async (id, vehicleId) => void calls.assigned.push({ id, vehicleId }),
    cancelTurn: async (id, userId, at) => void calls.cancelled.push({ id, userId, at }),
    deleteTurn: async (id) => void calls.deleted.push({ id }),
  };
  return { ports, calls };
}

describe("createDay", () => {
  const input = { date: "2026-11-28", opensAt: new Date("2026-11-28T12:00:00Z"), closesAt: new Date("2026-11-28T22:00:00Z") };

  it("creates the jornada for an admin", async () => {
    const { ports, calls } = fakePorts();
    await createTurnCommands(ports, () => OPEN).createDay(admin, input);
    expect(calls.insertedDays).toEqual([{ ...input, createdBy: "admin" }]);
  });
  it("refuses an enturner", async () => {
    const { ports } = fakePorts();
    await expect(createTurnCommands(ports, () => OPEN).createDay(enturner, input)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("refuses a second jornada on the same date", async () => {
    const { ports } = fakePorts();
    await expect(createTurnCommands(ports, () => OPEN).createDay(admin, { ...input, date: "2026-11-27" })).rejects.toThrow(/Ya existe/);
  });
  it("refuses an inverted window", async () => {
    const { ports } = fakePorts();
    await expect(
      createTurnCommands(ports, () => OPEN).createDay(admin, { ...input, closesAt: input.opensAt }),
    ).rejects.toBeInstanceOf(TurnError);
  });
});

describe("updateWindow", () => {
  const window = { opensAt: DAY.opensAt, closesAt: new Date("2026-11-27T23:30:00Z") };

  it("lets an admin extend, even after the window closed", async () => {
    const { ports, calls } = fakePorts();
    await createTurnCommands(ports, () => AFTER).updateWindow(admin, 1, window);
    expect(calls.windows).toEqual([{ id: 1, ...window }]);
  });
  it("refuses an enturner", async () => {
    const { ports } = fakePorts();
    await expect(createTurnCommands(ports, () => OPEN).updateWindow(enturner, 1, window)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("refuses an inverted window", async () => {
    const { ports } = fakePorts();
    await expect(
      createTurnCommands(ports, () => OPEN).updateWindow(admin, 1, { opensAt: window.closesAt, closesAt: window.opensAt }),
    ).rejects.toBeInstanceOf(TurnError);
  });
  it("fails on a jornada that does not exist", async () => {
    const { ports } = fakePorts();
    await expect(createTurnCommands(ports, () => OPEN).updateWindow(admin, 42, window)).rejects.toBeInstanceOf(TurnError);
  });
});

describe("enturn (create a request)", () => {
  const input = { turnDayId: 1, product: "  Cemento ", destination: " Finca La Esperanza ", neededTime: "08:30" };
  // 08:30 Bogotá on 2026-11-27 is 13:30Z.
  const NEEDED = new Date("2026-11-27T13:30:00Z");

  it("creates a pendiente request while open, with the needed instant in Bogotá time", async () => {
    const { ports, calls } = fakePorts();
    const result = await createTurnCommands(ports, () => OPEN).enturn(enturner, input);
    expect(calls.inserted).toEqual([
      { turnDayId: 1, vehicleId: null, product: "Cemento", destination: "Finca La Esperanza", neededAt: NEEDED, createdBy: "e1" },
    ]);
    expect(result.conflicts).toEqual([]);
  });
  it("refuses a blank product, a blank place and a bad hour", async () => {
    const { ports } = fakePorts();
    const commands = createTurnCommands(ports, () => OPEN);
    await expect(commands.enturn(enturner, { ...input, product: "  " })).rejects.toBeInstanceOf(TurnError);
    await expect(commands.enturn(enturner, { ...input, destination: "" })).rejects.toBeInstanceOf(TurnError);
    await expect(commands.enturn(enturner, { ...input, neededTime: "8:30pm" })).rejects.toBeInstanceOf(TurnError);
  });
  it("refuses an enturner outside the window", async () => {
    for (const now of [BEFORE, AFTER]) {
      const { ports } = fakePorts();
      await expect(createTurnCommands(ports, () => now).enturn(enturner, input)).rejects.toBeInstanceOf(TurnError);
    }
  });
  it("lets an admin create outside the window", async () => {
    const { ports, calls } = fakePorts();
    await createTurnCommands(ports, () => AFTER).enturn(admin, input);
    expect(calls.inserted).toHaveLength(1);
  });
  it("refuses a user without a flag", async () => {
    const { ports } = fakePorts();
    await expect(createTurnCommands(ports, () => OPEN).enturn(nobody, input)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("refuses a vehicle from an enturner", async () => {
    const { ports, calls } = fakePorts();
    await expect(createTurnCommands(ports, () => OPEN).enturn(enturner, { ...input, vehicleId: 5 })).rejects.toBeInstanceOf(ForbiddenError);
    expect(calls.inserted).toHaveLength(0);
  });
  it("lets an admin create it already assigned to an active vehicle", async () => {
    const { ports, calls } = fakePorts();
    await createTurnCommands(ports, () => OPEN).enturn(admin, { ...input, vehicleId: 5 });
    expect(calls.inserted[0]).toMatchObject({ vehicleId: 5 });
  });
  it("refuses an inactive or missing vehicle for the admin", async () => {
    const { ports } = fakePorts();
    const commands = createTurnCommands(ports, () => OPEN);
    await expect(commands.enturn(admin, { ...input, vehicleId: 6 })).rejects.toThrow(/activos/);
    await expect(commands.enturn(admin, { ...input, vehicleId: 77 })).rejects.toBeInstanceOf(TurnError);
  });
  it("fails on a jornada that does not exist", async () => {
    const { ports } = fakePorts();
    await expect(createTurnCommands(ports, () => OPEN).enturn(admin, { ...input, turnDayId: 42 })).rejects.toBeInstanceOf(TurnError);
  });
});

describe("updateTurn", () => {
  const queue = [turn({ id: 1 }), turn({ id: 2, createdBy: "e2" }), turn({ id: 3, vehicleId: 5 })];
  const fields = { product: " Arena ", destination: " Obra ", neededTime: "10:00" };

  it("lets an enturner edit her own pending request while open", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    await createTurnCommands(ports, () => OPEN).updateTurn(enturner, 1, fields);
    expect(calls.updated).toEqual([{ id: 1, product: "Arena", destination: "Obra", neededAt: new Date("2026-11-27T15:00:00Z") }]);
  });
  it("refuses an enturner on another's request, an assigned one or a closed window", async () => {
    const { ports } = fakePorts({ turns: queue });
    const commands = createTurnCommands(ports, () => OPEN);
    await expect(commands.updateTurn(enturner, 2, fields)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(commands.updateTurn(enturner, 3, fields)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createTurnCommands(ports, () => AFTER).updateTurn(enturner, 1, fields)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("lets an admin edit any request any time, warning when the new hour clashes with the same vehicle", async () => {
    // Turn 4 (vehicle 5) is needed at 14:30Z; moving turn 3 (vehicle 5) to 10:00 Bogotá = 15:00Z is 30 minutes away.
    const other = turn({ id: 4, vehicleId: 5, neededAt: new Date("2026-11-27T14:30:00Z") });
    const { ports, calls } = fakePorts({ turns: [...queue, other] });
    const result = await createTurnCommands(ports, () => AFTER).updateTurn(admin, 3, fields);
    expect(calls.updated).toHaveLength(1);
    expect(result.conflicts.map((c) => c.id)).toEqual([4]);
  });
  it("validates the fields", async () => {
    const { ports } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => OPEN).updateTurn(admin, 1, { ...fields, product: "" })).rejects.toBeInstanceOf(TurnError);
  });
  it("fails on a request that does not exist", async () => {
    const { ports } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => OPEN).updateTurn(admin, 99, fields)).rejects.toBeInstanceOf(TurnError);
  });
});

describe("assign", () => {
  const queue = [
    turn({ id: 1 }),
    turn({ id: 2, vehicleId: 5, neededAt: new Date("2026-11-27T13:30:00Z") }),
    turn({ id: 3, vehicleId: 5, neededAt: new Date("2026-11-27T20:00:00Z") }),
  ];

  it("assigns an active vehicle at any time, even closed", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    const result = await createTurnCommands(ports, () => AFTER).assign(admin, 3, 5);
    expect(calls.assigned).toEqual([{ id: 3, vehicleId: 5 }]);
    expect(result.conflicts).toEqual([]);
  });
  it("warns, without blocking, when the same vehicle has another request within 2 hours", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    const result = await createTurnCommands(ports, () => OPEN).assign(admin, 1, 5);
    expect(calls.assigned).toEqual([{ id: 1, vehicleId: 5 }]);
    expect(result.conflicts.map((c) => c.id)).toEqual([2]);
  });
  it("unassigns back to pendiente", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    const result = await createTurnCommands(ports, () => OPEN).assign(admin, 2, null);
    expect(calls.assigned).toEqual([{ id: 2, vehicleId: null }]);
    expect(result.conflicts).toEqual([]);
  });
  it("refuses a vehicle that is not active or does not exist", async () => {
    const { ports } = fakePorts({ turns: queue });
    const commands = createTurnCommands(ports, () => OPEN);
    await expect(commands.assign(admin, 1, 6)).rejects.toThrow(/activos/);
    await expect(commands.assign(admin, 1, 77)).rejects.toBeInstanceOf(TurnError);
  });
  it("refuses an enturner", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => OPEN).assign(enturner, 1, 5)).rejects.toBeInstanceOf(ForbiddenError);
    expect(calls.assigned).toHaveLength(0);
  });
  it("fails on a request that does not exist", async () => {
    const { ports } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => OPEN).assign(admin, 99, 5)).rejects.toBeInstanceOf(TurnError);
  });
});

describe("cancel", () => {
  const queue = [turn({ id: 1 }), turn({ id: 2, createdBy: "e2" }), turn({ id: 3, vehicleId: 5 })];

  it("cancels an own pending request while open", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    await createTurnCommands(ports, () => OPEN).cancel(enturner, 1);
    expect(calls.cancelled).toEqual([{ id: 1, userId: "e1", at: OPEN }]);
  });
  it("refuses another user's request to an enturner", async () => {
    const { ports } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => OPEN).cancel(enturner, 2)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("refuses an enturner on her own request once assigned", async () => {
    const { ports } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => OPEN).cancel(enturner, 3)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("refuses an enturner once the window closed", async () => {
    const { ports } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => AFTER).cancel(enturner, 1)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("lets an admin cancel any request any time", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    await createTurnCommands(ports, () => AFTER).cancel(admin, 3);
    expect(calls.cancelled).toHaveLength(1);
  });
  it("fails on a request that does not exist", async () => {
    const { ports } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => OPEN).cancel(admin, 99)).rejects.toBeInstanceOf(TurnError);
  });
});

describe("delete", () => {
  const queue = [turn({ id: 1 }), turn({ id: 2, createdBy: "e2" })];

  it("lets an admin delete any request any time", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    await createTurnCommands(ports, () => AFTER).deleteTurn(admin, 1);
    expect(calls.deleted).toEqual([{ id: 1 }]);
  });
  it("refuses an enturner, even for her own request while open", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => OPEN).deleteTurn(enturner, 1)).rejects.toBeInstanceOf(ForbiddenError);
    expect(calls.deleted).toHaveLength(0);
  });
  it("fails friendly on a request that does not exist", async () => {
    const { ports } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => OPEN).deleteTurn(admin, 99)).rejects.toThrow("ya no existe");
  });
});
