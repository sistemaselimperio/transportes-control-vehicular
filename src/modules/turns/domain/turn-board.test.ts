import { describe, expect, it } from "vitest";
import { buildTurnBoard, type TurnDayRow, type TurnRow } from "./turn-board";
import type { TurnActor } from "./turn-rules";

const day: TurnDayRow = { id: 1, date: "2026-11-27", opensAt: new Date("2026-11-27T12:00:00Z"), closesAt: new Date("2026-11-27T22:00:00Z") };
const OPEN = new Date("2026-11-27T15:00:00Z");
const CLOSED = new Date("2026-11-27T23:00:00Z");

const turn = (id: number, createdBy: string): TurnRow => ({
  id,
  position: id,
  vehicleId: id,
  plate: `AAA-00${id}`,
  destination: null,
  createdBy,
  createdByName: createdBy,
  createdAt: new Date("2026-11-27T13:00:00Z"),
});

const admin: TurnActor = { userId: "admin", canAdmin: true, canEnturn: false };
const enturner: TurnActor = { userId: "e1", canAdmin: false, canEnturn: true };

describe("buildTurnBoard", () => {
  it("lets an enturner enturn and cancel only her own turns while open", () => {
    const board = buildTurnBoard({ actor: enturner, day, turns: [turn(1, "e1"), turn(2, "e2")], now: OPEN });
    expect(board.status).toBe("open");
    expect(board.canEnturn).toBe(true);
    expect(board.canManage).toBe(false);
    expect(board.turns.map((t) => t.canCancel)).toEqual([true, false]);
    expect(board.turns.some((t) => t.canDelete)).toBe(false);
  });

  it("locks an enturner out once closed but keeps the queue visible", () => {
    const board = buildTurnBoard({ actor: enturner, day, turns: [turn(1, "e1")], now: CLOSED });
    expect(board.status).toBe("closed");
    expect(board.canEnturn).toBe(false);
    expect(board.turns).toHaveLength(1);
    expect(board.turns[0].canCancel).toBe(false);
  });

  it("gives an admin everything, also when closed, and marks reorder bounds", () => {
    const board = buildTurnBoard({ actor: admin, day, turns: [turn(1, "e1"), turn(2, "e2"), turn(3, "e1")], now: CLOSED });
    expect(board.canEnturn).toBe(true);
    expect(board.canManage).toBe(true);
    expect(board.turns.every((t) => t.canCancel)).toBe(true);
    expect(board.turns.every((t) => t.canDelete)).toBe(true);
    expect(board.turns.map((t) => [t.canMoveUp, t.canMoveDown])).toEqual([
      [false, true],
      [true, true],
      [true, false],
    ]);
  });

  it("never offers reordering to an enturner", () => {
    const board = buildTurnBoard({ actor: enturner, day, turns: [turn(1, "e1"), turn(2, "e1")], now: OPEN });
    expect(board.turns.some((t) => t.canMoveUp || t.canMoveDown)).toBe(false);
  });

  it("orders the queue by position", () => {
    const board = buildTurnBoard({ actor: admin, day, turns: [turn(3, "a"), turn(1, "a")], now: OPEN });
    expect(board.turns.map((t) => t.id)).toEqual([1, 3]);
  });

  it("offers creating the jornada to an admin only when there is none", () => {
    expect(buildTurnBoard({ actor: admin, day: null, turns: [], now: OPEN })).toMatchObject({ status: null, canCreateDay: true, canEnturn: false });
    expect(buildTurnBoard({ actor: enturner, day: null, turns: [], now: OPEN }).canCreateDay).toBe(false);
    expect(buildTurnBoard({ actor: admin, day, turns: [], now: OPEN }).canCreateDay).toBe(false);
  });

  it("explains why an enturner cannot enturn", () => {
    expect(buildTurnBoard({ actor: enturner, day, turns: [], now: OPEN }).enturnBlockedReason).toBeNull();
    expect(buildTurnBoard({ actor: enturner, day, turns: [], now: CLOSED }).enturnBlockedReason).toMatch(/cerrada/);
    expect(buildTurnBoard({ actor: enturner, day, turns: [], now: new Date("2026-11-27T10:00:00Z") }).enturnBlockedReason).toMatch(/abre/);
    expect(buildTurnBoard({ actor: enturner, day: null, turns: [], now: OPEN }).enturnBlockedReason).toMatch(/No hay jornada/);
  });
});
