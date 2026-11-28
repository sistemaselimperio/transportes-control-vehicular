import { describe, expect, it } from "vitest";
import { buildTurnBoard, type TurnDayRow, type TurnRow } from "./turn-board";
import type { TurnActor } from "./turn-rules";

const day: TurnDayRow = { id: 1, date: "2026-11-27", opensAt: new Date("2026-11-27T12:00:00Z"), closesAt: new Date("2026-11-27T22:00:00Z") };
const OPEN = new Date("2026-11-27T15:00:00Z");
const CLOSED = new Date("2026-11-27T23:00:00Z");

const turn = (id: number, createdBy: string, over: Partial<TurnRow> = {}): TurnRow => ({
  id,
  vehicleId: null,
  plate: null,
  product: "Cemento",
  destination: "Finca",
  neededAt: new Date("2026-11-27T13:00:00Z"),
  createdBy,
  createdByName: createdBy,
  createdAt: new Date("2026-11-27T12:30:00Z"),
  ...over,
});

const admin: TurnActor = { userId: "admin", canAdmin: true, canEnturn: false };
const enturner: TurnActor = { userId: "e1", canAdmin: false, canEnturn: true };

describe("buildTurnBoard", () => {
  it("lets an enturner edit and cancel only her own pending requests while open", () => {
    const board = buildTurnBoard({ actor: enturner, day, turns: [turn(1, "e1"), turn(2, "e2"), turn(3, "e1", { vehicleId: 9, plate: "AAA111" })], now: OPEN });
    expect(board.status).toBe("open");
    expect(board.canEnturn).toBe(true);
    expect(board.canManage).toBe(false);
    expect(board.turns.map((t) => t.canCancel)).toEqual([true, false, false]);
    expect(board.turns.map((t) => t.canEdit)).toEqual([true, false, false]);
    expect(board.turns.some((t) => t.canDelete || t.canAssign)).toBe(false);
  });

  it("locks an enturner out once closed but keeps the list visible", () => {
    const board = buildTurnBoard({ actor: enturner, day, turns: [turn(1, "e1")], now: CLOSED });
    expect(board.status).toBe("closed");
    expect(board.canEnturn).toBe(false);
    expect(board.turns).toHaveLength(1);
    expect(board.turns[0].canCancel).toBe(false);
    expect(board.turns[0].canEdit).toBe(false);
  });

  it("gives an admin everything, also when closed", () => {
    const board = buildTurnBoard({ actor: admin, day, turns: [turn(1, "e1"), turn(2, "e2", { vehicleId: 4, plate: "BBB222" })], now: CLOSED });
    expect(board.canEnturn).toBe(true);
    expect(board.canManage).toBe(true);
    expect(board.turns.every((t) => t.canCancel && t.canEdit && t.canDelete && t.canAssign)).toBe(true);
  });

  it("derives the status from the vehicle", () => {
    const board = buildTurnBoard({ actor: admin, day, turns: [turn(1, "e1"), turn(2, "e1", { vehicleId: 4, plate: "BBB222" })], now: OPEN });
    expect(board.turns.map((t) => t.status)).toEqual(["pendiente", "asignado"]);
  });

  it("orders by needed hour, then by creation", () => {
    const early = new Date("2026-11-27T12:00:00Z");
    const late = new Date("2026-11-27T18:00:00Z");
    const board = buildTurnBoard({
      actor: admin,
      day,
      turns: [
        turn(1, "a", { neededAt: late }),
        turn(2, "a", { neededAt: early, createdAt: new Date("2026-11-27T12:40:00Z") }),
        turn(3, "a", { neededAt: early, createdAt: new Date("2026-11-27T12:10:00Z") }),
      ],
      now: OPEN,
    });
    expect(board.turns.map((t) => t.id)).toEqual([3, 2, 1]);
  });

  it("flags requests of the same vehicle less than two hours apart", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 10, 27, h));
    const board = buildTurnBoard({
      actor: admin,
      day,
      turns: [
        turn(1, "a", { vehicleId: 5, plate: "AAA111", neededAt: at(12) }),
        turn(2, "a", { vehicleId: 5, plate: "AAA111", neededAt: at(13) }),
        turn(3, "a", { vehicleId: 5, plate: "AAA111", neededAt: at(20) }),
        turn(4, "a", { neededAt: at(12) }),
      ],
      now: OPEN,
    });
    expect(Object.fromEntries(board.turns.map((t) => [t.id, t.closeToAnother]))).toEqual({ 1: true, 2: true, 3: false, 4: false });
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
