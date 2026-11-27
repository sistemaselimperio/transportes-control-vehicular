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
  vehicleId: over.id * 100,
  destination: null,
  position: over.id,
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
    cancelled: [] as unknown[],
    deleted: [] as unknown[],
    positions: [] as unknown[],
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
    cancelTurn: async (id, userId, at, renumbered) => void calls.cancelled.push({ id, userId, at, renumbered }),
    deleteTurn: async (id, renumbered) => void calls.deleted.push({ id, renumbered }),
    savePositions: async (updates) => void calls.positions.push(updates),
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

describe("enturn", () => {
  const input = { turnDayId: 1, vehicleId: 5, destination: "  Finca La Esperanza " };

  it("enturns an active vehicle last in the queue while open", async () => {
    const { ports, calls } = fakePorts({ turns: [turn({ id: 1, position: 1 }), turn({ id: 2, position: 2 })] });
    await createTurnCommands(ports, () => OPEN).enturn(enturner, input);
    expect(calls.inserted).toEqual([
      { turnDayId: 1, vehicleId: 5, destination: "Finca La Esperanza", position: 3, createdBy: "e1" },
    ]);
  });
  it("stores a blank destination as null", async () => {
    const { ports, calls } = fakePorts();
    await createTurnCommands(ports, () => OPEN).enturn(enturner, { ...input, destination: "   " });
    expect(calls.inserted[0]).toMatchObject({ destination: null, position: 1 });
  });
  it("refuses an enturner outside the window", async () => {
    for (const now of [BEFORE, AFTER]) {
      const { ports } = fakePorts();
      await expect(createTurnCommands(ports, () => now).enturn(enturner, input)).rejects.toBeInstanceOf(TurnError);
    }
  });
  it("lets an admin enturn outside the window", async () => {
    const { ports, calls } = fakePorts();
    await createTurnCommands(ports, () => AFTER).enturn(admin, input);
    expect(calls.inserted).toHaveLength(1);
  });
  it("refuses a user without a flag", async () => {
    const { ports } = fakePorts();
    await expect(createTurnCommands(ports, () => OPEN).enturn(nobody, input)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("refuses a vehicle that is not active", async () => {
    const { ports } = fakePorts();
    await expect(createTurnCommands(ports, () => OPEN).enturn(enturner, { ...input, vehicleId: 6 })).rejects.toThrow(/activos/);
  });
  it("refuses a vehicle that does not exist", async () => {
    const { ports } = fakePorts();
    await expect(createTurnCommands(ports, () => OPEN).enturn(enturner, { ...input, vehicleId: 77 })).rejects.toBeInstanceOf(TurnError);
  });
  it("refuses a vehicle already in the queue, naming who enturned it", async () => {
    const { ports } = fakePorts({ turns: [turn({ id: 1, vehicleId: 5, createdByName: "Rocío" })] });
    await expect(createTurnCommands(ports, () => OPEN).enturn(enturner, input)).rejects.toThrow("Ya enturnado por Rocío.");
  });
  it("fails on a jornada that does not exist", async () => {
    const { ports } = fakePorts();
    await expect(createTurnCommands(ports, () => OPEN).enturn(admin, { ...input, turnDayId: 42 })).rejects.toBeInstanceOf(TurnError);
  });
});

describe("cancel", () => {
  const queue = [turn({ id: 1, position: 1 }), turn({ id: 2, position: 2, createdBy: "e2" }), turn({ id: 3, position: 3 })];

  it("cancels an own turn while open and compacts the rest", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    await createTurnCommands(ports, () => OPEN).cancel(enturner, 1);
    expect(calls.cancelled).toEqual([
      {
        id: 1,
        userId: "e1",
        at: OPEN,
        renumbered: [
          { id: 2, position: 1 },
          { id: 3, position: 2 },
        ],
      },
    ]);
  });
  it("refuses another user's turn to an enturner", async () => {
    const { ports } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => OPEN).cancel(enturner, 2)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("refuses an enturner once the window closed", async () => {
    const { ports } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => AFTER).cancel(enturner, 1)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("lets an admin cancel any turn any time", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    await createTurnCommands(ports, () => AFTER).cancel(admin, 2);
    expect(calls.cancelled).toHaveLength(1);
  });
  it("fails on a turn that does not exist", async () => {
    const { ports } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => OPEN).cancel(admin, 99)).rejects.toBeInstanceOf(TurnError);
  });
});

describe("delete", () => {
  const queue = [turn({ id: 1, position: 1 }), turn({ id: 2, position: 2, createdBy: "e2" }), turn({ id: 3, position: 3 })];

  it("lets an admin delete any turn any time and compacts the rest", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    await createTurnCommands(ports, () => AFTER).deleteTurn(admin, 1);
    expect(calls.deleted).toEqual([
      {
        id: 1,
        renumbered: [
          { id: 2, position: 1 },
          { id: 3, position: 2 },
        ],
      },
    ]);
  });
  it("refuses an enturner, even for her own turn while open", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => OPEN).deleteTurn(enturner, 1)).rejects.toBeInstanceOf(ForbiddenError);
    expect(calls.deleted).toHaveLength(0);
  });
  it("fails friendly on a turn that does not exist", async () => {
    const { ports } = fakePorts({ turns: queue });
    await expect(createTurnCommands(ports, () => OPEN).deleteTurn(admin, 99)).rejects.toThrow("ya no existe");
  });
});

describe("reorder", () => {
  const queue = [turn({ id: 1, position: 1 }), turn({ id: 2, position: 2 }), turn({ id: 3, position: 3 })];

  it("moves a turn up for an admin", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    await createTurnCommands(ports, () => OPEN).move(admin, 3, "up");
    expect(calls.positions).toEqual([
      [
        { id: 1, position: 1 },
        { id: 3, position: 2 },
        { id: 2, position: 3 },
      ],
    ]);
  });
  it("moves a turn to a position", async () => {
    const { ports, calls } = fakePorts({ turns: queue });
    await createTurnCommands(ports, () => OPEN).moveTo(admin, 3, 1);
    expect(calls.positions[0]).toEqual([
      { id: 3, position: 1 },
      { id: 1, position: 2 },
      { id: 2, position: 3 },
    ]);
  });
  it("refuses an enturner", async () => {
    const { ports } = fakePorts({ turns: queue });
    const commands = createTurnCommands(ports, () => OPEN);
    await expect(commands.move(enturner, 3, "up")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(commands.moveTo(enturner, 3, 1)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
