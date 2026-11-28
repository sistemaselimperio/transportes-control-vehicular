import { describe, expect, it } from "vitest";
import {
  assertVehicleAssignable,
  canCancelTurn,
  canDeleteTurn,
  canCreateTurn,
  canEditTurn,
  canManageTurns,
  closeAssignmentWarning,
  findCloseAssignments,
  isWithinTwoHours,
  turnStatus,
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

describe("turnStatus", () => {
  it("is pendiente without a vehicle and asignado with one", () => {
    expect(turnStatus({ vehicleId: null })).toBe("pendiente");
    expect(turnStatus({ vehicleId: 3 })).toBe("asignado");
  });
});

describe("canCancelTurn / canEditTurn", () => {
  const own = { createdBy: "e1", vehicleId: null };
  const other = { createdBy: "e2", vehicleId: null };
  const assigned = { createdBy: "e1", vehicleId: 7 };
  for (const [name, can] of [["cancel", canCancelTurn], ["edit", canEditTurn]] as const) {
    it(`lets an admin ${name} any turn at any time, assigned or not`, () => {
      expect(can(admin, other, day, AT_CLOSE)).toBe(true);
      expect(can(admin, assigned, day, BEFORE)).toBe(true);
    });
    it(`lets an enturner ${name} only her own pending turn while open`, () => {
      expect(can(enturner, own, day, INSIDE)).toBe(true);
      expect(can(enturner, other, day, INSIDE)).toBe(false);
      expect(can(enturner, own, day, AT_CLOSE)).toBe(false);
      expect(can(enturner, own, day, BEFORE)).toBe(false);
    });
    it(`refuses an enturner once the turn is assigned (${name})`, () => {
      expect(can(enturner, assigned, day, INSIDE)).toBe(false);
    });
    it(`refuses a turn without an author to an enturner (${name})`, () => {
      expect(can(enturner, { createdBy: null, vehicleId: null }, day, INSIDE)).toBe(false);
    });
    it(`refuses a user without a flag (${name})`, () => expect(can(nobody, own, day, INSIDE)).toBe(false));
  }
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

describe("assertVehicleAssignable", () => {
  it("accepts an active vehicle", () => expect(() => assertVehicleAssignable("ACTIVE")).not.toThrow());
  it.each(["IDLE", "IN_WORKSHOP", "SOLD"])("rejects %s", (status) => {
    expect(() => assertVehicleAssignable(status)).toThrow(TurnError);
  });
});

describe("isWithinTwoHours", () => {
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 27, h, m));
  it("is true under two hours apart, in either direction", () => {
    expect(isWithinTwoHours(at(12), at(13, 59))).toBe(true);
    expect(isWithinTwoHours(at(13, 59), at(12))).toBe(true);
    expect(isWithinTwoHours(at(12), at(12))).toBe(true);
  });
  it("is false at exactly two hours or more", () => {
    expect(isWithinTwoHours(at(12), at(14))).toBe(false);
    expect(isWithinTwoHours(at(12), at(16))).toBe(false);
  });
});

describe("findCloseAssignments", () => {
  const t = (id: number, vehicleId: number | null, hour: number) => ({ id, vehicleId, neededAt: new Date(Date.UTC(2026, 10, 27, hour)) });
  const others = [t(1, 5, 12), t(2, 5, 20), t(3, 6, 12), t(4, null, 12), t(5, 5, 13)];
  it("returns the other turns of the same vehicle within two hours", () => {
    expect(findCloseAssignments(t(9, 5, 12), others).map((x) => x.id)).toEqual([1, 5]);
  });
  it("ignores the turn itself", () => {
    expect(findCloseAssignments(t(1, 5, 12), others).map((x) => x.id)).toEqual([5]);
  });
  it("finds nothing for an unassigned turn", () => {
    expect(findCloseAssignments(t(9, null, 12), others)).toEqual([]);
  });
});

describe("closeAssignmentWarning", () => {
  it("is null without conflicts", () => expect(closeAssignmentWarning([])).toBeNull());
  it("names the hours of the conflicting requests", () => {
    const warning = closeAssignmentWarning([{ neededAt: new Date("2026-11-27T13:00:00Z") }, { neededAt: new Date("2026-11-27T14:30:00Z") }]);
    expect(warning).toContain("8:00 a. m.");
    expect(warning).toContain("9:30 a. m.");
    expect(warning).toMatch(/2 horas/);
  });
});

describe("canDeleteTurn", () => {
  it("lets only an admin delete a turn", () => {
    expect(canDeleteTurn(admin)).toBe(true);
    expect(canDeleteTurn(enturner)).toBe(false);
    expect(canDeleteTurn(nobody)).toBe(false);
  });
});
