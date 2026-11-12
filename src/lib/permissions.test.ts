import { describe, expect, it } from "vitest";
import {
  canAssignDrivers,
  canManageDrivers,
  canManageSection,
  canManageTrips,
  canUsePettyCash,
  canViewSection,
  ForbiddenError,
  homePath,
  parseRole,
  sectionOfPath,
  type Role,
  type Section,
} from "./permissions";

describe("parseRole", () => {
  it("keeps the known roles", () => {
    expect(parseRole("admin")).toBe("admin");
    expect(parseRole("staff")).toBe("staff");
  });

  it("falls back to the least privileged role", () => {
    expect(parseRole(undefined)).toBe("staff");
    expect(parseRole(null)).toBe("staff");
    expect(parseRole("")).toBe("staff");
    expect(parseRole("root")).toBe("staff");
    expect(parseRole("ADMIN")).toBe("staff");
  });
});

const SECTIONS: ReadonlyArray<Section> = ["today", "fleet", "drivers", "inspections", "trips", "logbook", "owners", "sales"];

/** The agreed matrix: "manage" = every write, "read" = view only, "locked" = not even the page. */
const MATRIX: Record<Role, Record<Section, "manage" | "read" | "locked">> = {
  admin: {
    today: "read",
    fleet: "manage",
    drivers: "manage",
    inspections: "manage",
    trips: "read",
    logbook: "manage",
    owners: "manage",
    sales: "manage",
  },
  staff: {
    today: "locked",
    fleet: "read",
    drivers: "manage",
    inspections: "read",
    trips: "manage",
    logbook: "locked",
    owners: "read",
    sales: "locked",
  },
};

describe("access matrix", () => {
  for (const role of ["admin", "staff"] as const) {
    for (const section of SECTIONS) {
      const level = MATRIX[role][section];
      it(`${role} on ${section} is ${level}`, () => {
        expect(canViewSection(role, section)).toBe(level !== "locked");
        expect(canManageSection(role, section)).toBe(level === "manage");
      });
    }
  }

  it("never lets a role manage what it cannot view", () => {
    for (const role of ["admin", "staff"] as const) {
      for (const section of SECTIONS) {
        if (canManageSection(role, section)) expect(canViewSection(role, section)).toBe(true);
      }
    }
  });
});

describe("canAssignDrivers", () => {
  it("lets admins and staff change a vehicle's driver, even though staff only reads the fleet", () => {
    expect(canAssignDrivers("admin")).toBe(true);
    expect(canAssignDrivers("staff")).toBe(true);
    expect(canManageSection("staff", "fleet")).toBe(false);
  });
});

describe("homePath", () => {
  it("sends each role to its first visible section", () => {
    expect(homePath("admin")).toBe("/");
    expect(homePath("staff")).toBe("/flota");
  });
});

describe("sectionOfPath", () => {
  it("maps each page to its section", () => {
    expect(sectionOfPath("/")).toBe("today");
    expect(sectionOfPath("/flota")).toBe("fleet");
    expect(sectionOfPath("/flota/ABC123")).toBe("fleet");
    expect(sectionOfPath("/conductores")).toBe("drivers");
    expect(sectionOfPath("/bitacora")).toBe("logbook");
    expect(sectionOfPath("/preoperacionales")).toBe("inspections");
    expect(sectionOfPath("/preoperacionales/0b9d2c1e")).toBe("inspections");
    expect(sectionOfPath("/viajes")).toBe("trips");
    expect(sectionOfPath("/propietarios")).toBe("owners");
    expect(sectionOfPath("/ventas")).toBe("sales");
  });

  it("does not match a path that merely starts with a section name", () => {
    expect(sectionOfPath("/flotante")).toBeNull();
    expect(sectionOfPath("/login")).toBeNull();
  });

  it("leaves the public inspection form outside every section", () => {
    expect(sectionOfPath("/preoperacional")).toBeNull();
  });
});

describe("ForbiddenError", () => {
  it("carries a user-facing message", () => {
    const error = new ForbiddenError();
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("No tienes permiso para realizar esta acción.");
  });
});

describe("canManageDrivers", () => {
  it("allows admins and staff to create, edit and delete drivers", () => {
    expect(canManageDrivers("admin")).toBe(true);
    expect(canManageDrivers("staff")).toBe(true);
  });

  it("follows the drivers row of the matrix", () => {
    for (const role of ["admin", "staff"] as const) {
      expect(canManageDrivers(role)).toBe(canManageSection(role, "drivers"));
    }
  });
});

describe("canManageTrips", () => {
  it("allows only staff to create, edit and delete trips; an admin just reads them", () => {
    expect(canManageTrips("staff")).toBe(true);
    expect(canManageTrips("admin")).toBe(false);
  });
});

describe("canUsePettyCash", () => {
  it("is only for users flagged for it, whatever their role", () => {
    expect(canUsePettyCash(true)).toBe(true);
    expect(canUsePettyCash(false)).toBe(false);
  });

  it("is closed for anything that is not exactly true", () => {
    expect(canUsePettyCash(undefined)).toBe(false);
    expect(canUsePettyCash(null)).toBe(false);
    expect(canUsePettyCash("true")).toBe(false);
    expect(canUsePettyCash(1)).toBe(false);
  });
});
