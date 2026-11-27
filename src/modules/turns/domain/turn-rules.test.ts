import { describe, expect, it } from "vitest";
import {
  assertVehicleEnturnable,
  canCancelTurn,
  canDeleteTurn,
  canCreateTurn,
  canManageTurns,
  compactPositions,
  duplicateVehicleMessage,
  moveTurn,
  moveTurnTo,
  nextPosition,
  TurnError,
  validateWindow,
  windowStatus,
  type TurnActor,
} from "./turn-rules";

const day = { opensAt: new Date("2026-11-27T12:00:00Z"), closesAt: new Date("2026-11-27T22:00:00Z") };
const BEFORE = new Date("2026-11-27T11:59:59Z");
const INSIDE = new Date("2026-11-27T15:00:00Z");
const AT_CLOSE = new Date("2026-11-27T22:00:00Z");

const admin: TurnActor = { userId: "admin", canAdmin: true, canEnturn: false };
const enturner: TurnActor = { userId: "e1", canAdmin: false, canEnturn: true };
const nobody: TurnActor = { userId: "x", canAdmin: false, canEnturn: false };

describe("windowStatus", () => {
  it("is pending before the window opens", () => expect(windowStatus(day, BEFORE)).toBe("pending"));
  it("is open from the opening instant", () => expect(windowStatus(day, day.opensAt)).toBe("open"));
  it("is open inside the window", () => expect(windowStatus(day, INSIDE)).toBe("open"));
  it("is closed at the closing instant", () => expect(windowStatus(day, AT_CLOSE)).toBe("closed"));
  it("is closed after it", () => expect(windowStatus(day, new Date("2026-11-28T00:00:00Z"))).toBe("closed"));
});

describe("canCreateTurn", () => {
  it("lets an admin enturn at any time", () => {
    for (const now of [BEFORE, INSIDE, AT_CLOSE]) expect(canCreateTurn(admin, day, now)).toBe(true);
  });
  it("lets an enturner enturn only while open", () => {
    expect(canCreateTurn(enturner, day, INSIDE)).toBe(true);
    expect(canCreateTurn(enturner, day, BEFORE)).toBe(false);
    expect(canCreateTurn(enturner, day, AT_CLOSE)).toBe(false);
  });
  it("refuses a user without a flag", () => expect(canCreateTurn(nobody, day, INSIDE)).toBe(false));
});

describe("canCancelTurn", () => {
  const own = { createdBy: "e1" };
  const other = { createdBy: "e2" };
  it("lets an admin cancel any turn at any time", () => {
    expect(canCancelTurn(admin, other, day, AT_CLOSE)).toBe(true);
    expect(canCancelTurn(admin, own, day, BEFORE)).toBe(true);
  });
  it("lets an enturner cancel only their own turn while open", () => {
    expect(canCancelTurn(enturner, own, day, INSIDE)).toBe(true);
    expect(canCancelTurn(enturner, other, day, INSIDE)).toBe(false);
    expect(canCancelTurn(enturner, own, day, AT_CLOSE)).toBe(false);
  });
  it("refuses a turn without an author to an enturner", () => {
    expect(canCancelTurn(enturner, { createdBy: null }, day, INSIDE)).toBe(false);
  });
  it("refuses a user without a flag", () => expect(canCancelTurn(nobody, own, day, INSIDE)).toBe(false));
});

describe("canManageTurns", () => {
  it("is for admins only", () => {
    expect(canManageTurns(admin)).toBe(true);
    expect(canManageTurns(enturner)).toBe(false);
    expect(canManageTurns(nobody)).toBe(false);
  });
});

describe("validateWindow", () => {
  it("accepts an opening before the closing", () => expect(validateWindow(day.opensAt, day.closesAt)).toBeNull());
  it("rejects an equal or inverted window", () => {
    expect(validateWindow(day.opensAt, day.opensAt)).toMatch(/anterior/);
    expect(validateWindow(day.closesAt, day.opensAt)).toMatch(/anterior/);
  });
  it("rejects an invalid date", () => expect(validateWindow(new Date("nope"), day.closesAt)).not.toBeNull());
});

describe("assertVehicleEnturnable", () => {
  it("accepts an active vehicle", () => expect(() => assertVehicleEnturnable("ACTIVE")).not.toThrow());
  it.each(["IDLE", "IN_WORKSHOP", "SOLD"])("rejects %s", (status) => {
    expect(() => assertVehicleEnturnable(status)).toThrow(TurnError);
  });
});

describe("duplicateVehicleMessage", () => {
  it("names who enturned the vehicle", () => expect(duplicateVehicleMessage("Rocío")).toBe("Ya enturnado por Rocío."));
  it("falls back when the author is unknown", () => expect(duplicateVehicleMessage(null)).toBe("Ya enturnado."));
});

describe("positions", () => {
  const turns = [
    { id: 10, position: 1 },
    { id: 11, position: 3 },
    { id: 12, position: 4 },
  ];
  it("gives the next position after the highest", () => {
    expect(nextPosition([])).toBe(1);
    expect(nextPosition(turns)).toBe(5);
  });
  it("compacts gaps keeping the order", () => {
    expect(compactPositions(turns)).toEqual([
      { id: 10, position: 1 },
      { id: 11, position: 2 },
      { id: 12, position: 3 },
    ]);
  });
  it("breaks ties by id", () => {
    expect(compactPositions([{ id: 2, position: 1 }, { id: 1, position: 1 }]).map((t) => t.id)).toEqual([1, 2]);
  });
  it("moves a turn up and down", () => {
    expect(moveTurn(turns, 11, "up").map((t) => t.id)).toEqual([11, 10, 12]);
    expect(moveTurn(turns, 11, "down").map((t) => t.id)).toEqual([10, 12, 11]);
  });
  it("renumbers 1..n after a move", () => {
    expect(moveTurn(turns, 11, "up")).toEqual([
      { id: 11, position: 1 },
      { id: 10, position: 2 },
      { id: 12, position: 3 },
    ]);
  });
  it("keeps the order when moving past an end", () => {
    expect(moveTurn(turns, 10, "up").map((t) => t.id)).toEqual([10, 11, 12]);
    expect(moveTurn(turns, 12, "down").map((t) => t.id)).toEqual([10, 11, 12]);
  });
  it("moves a turn to a position, clamped to the queue", () => {
    expect(moveTurnTo(turns, 12, 1).map((t) => t.id)).toEqual([12, 10, 11]);
    expect(moveTurnTo(turns, 10, 99).map((t) => t.id)).toEqual([11, 12, 10]);
    expect(moveTurnTo(turns, 10, 0).map((t) => t.id)).toEqual([10, 11, 12]);
  });
  it("fails on a turn that is not in the queue", () => {
    expect(() => moveTurn(turns, 99, "up")).toThrow(TurnError);
  });
});

describe("canDeleteTurn", () => {
  it("lets only an admin delete a turn", () => {
    expect(canDeleteTurn(admin)).toBe(true);
    expect(canDeleteTurn(enturner)).toBe(false);
    expect(canDeleteTurn(nobody)).toBe(false);
  });
});
