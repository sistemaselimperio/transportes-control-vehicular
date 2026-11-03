import { describe, expect, it } from "vitest";
import { canAssignDrivers, canManageDrivers, canViewSection, canWrite, ForbiddenError, homePath, parseRole, sectionOfPath } from "./permissions";

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

describe("canViewSection", () => {
  it("lets an admin see every section", () => {
    for (const section of ["today", "fleet", "drivers", "inspections", "logbook", "owners", "sales"] as const) {
      expect(canViewSection("admin", section)).toBe(true);
    }
  });

  it("lets staff see only the fleet, the drivers and the inspections", () => {
    expect(canViewSection("staff", "fleet")).toBe(true);
    expect(canViewSection("staff", "drivers")).toBe(true);
    expect(canViewSection("staff", "inspections")).toBe(true);
    for (const section of ["today", "logbook", "owners", "sales"] as const) {
      expect(canViewSection("staff", section)).toBe(false);
    }
  });
});

describe("canWrite", () => {
  it("allows writes only for admins", () => {
    expect(canWrite("admin")).toBe(true);
    expect(canWrite("staff")).toBe(false);
  });
});

describe("canAssignDrivers", () => {
  it("lets admins and staff change a vehicle's driver", () => {
    expect(canAssignDrivers("admin")).toBe(true);
    expect(canAssignDrivers("staff")).toBe(true);
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

  it("does not widen canWrite for staff", () => {
    expect(canWrite("staff")).toBe(false);
  });
});
