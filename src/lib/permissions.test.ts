import { describe, expect, it } from "vitest";
import {
  canAssignDrivers,
  canDeleteVehicles,
  canEditVehicles,
  canManageVehicleFiles,
  canTransferVehicles,
  canManageDrivers,
  canManageSection,
  canManageTrips,
  canSetKgPerBag,
  canUsePettyCash,
  canViewSection,
  ForbiddenError,
  homePath,
  isCommercialRole,
  parseRole,
  sectionOfPath,
  type Role,
  type Section,
} from "./permissions";

describe("parseRole", () => {
  it("keeps the known roles", () => {
    expect(parseRole("admin")).toBe("admin");
    expect(parseRole("staff")).toBe("staff");
    expect(parseRole("assistant")).toBe("assistant");
    expect(parseRole("superadmin")).toBe("superadmin");
    expect(parseRole("dispatcher")).toBe("dispatcher");
    expect(parseRole("loader")).toBe("loader");
  });

  it("falls back to the least privileged role", () => {
    expect(parseRole(undefined)).toBe("staff");
    expect(parseRole(null)).toBe("staff");
    expect(parseRole("")).toBe("staff");
    expect(parseRole("root")).toBe("staff");
    expect(parseRole("ADMIN")).toBe("staff");
    expect(parseRole("Assistant")).toBe("staff");
    expect(parseRole("commercial")).toBe("staff");
  });
});

const SECTIONS: ReadonlyArray<Section> = [
  "today",
  "fleet",
  "drivers",
  "inspections",
  "trips",
  "logbook",
  "owners",
  "sales",
  "clients",
  "deliveries",
  "loads",
  "orders",
];

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
    clients: "locked",
    deliveries: "locked",
    loads: "locked",
    orders: "locked",
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
    clients: "locked",
    deliveries: "locked",
    loads: "locked",
    orders: "locked",
  },
  assistant: {
    today: "read",
    fleet: "read",
    drivers: "read",
    inspections: "read",
    trips: "read",
    logbook: "locked",
    owners: "locked",
    sales: "locked",
    clients: "locked",
    deliveries: "locked",
    loads: "locked",
    orders: "locked",
  },
  superadmin: {
    today: "manage",
    fleet: "manage",
    drivers: "manage",
    inspections: "manage",
    trips: "manage",
    logbook: "manage",
    owners: "manage",
    sales: "manage",
    clients: "manage",
    deliveries: "manage",
    loads: "manage",
    orders: "manage",
  },
  dispatcher: {
    today: "locked",
    fleet: "locked",
    drivers: "locked",
    inspections: "locked",
    trips: "locked",
    logbook: "locked",
    owners: "locked",
    sales: "locked",
    clients: "manage",
    deliveries: "manage",
    loads: "read",
    orders: "manage",
  },
  loader: {
    today: "locked",
    fleet: "locked",
    drivers: "locked",
    inspections: "locked",
    trips: "locked",
    logbook: "locked",
    owners: "locked",
    sales: "locked",
    clients: "manage",
    deliveries: "read",
    loads: "manage",
    orders: "read",
  },
};

const ROLES = ["admin", "staff", "assistant", "superadmin", "dispatcher", "loader"] as const;

describe("access matrix", () => {
  for (const role of ROLES) {
    for (const section of SECTIONS) {
      const level = MATRIX[role][section];
      it(`${role} on ${section} is ${level}`, () => {
        expect(canViewSection(role, section)).toBe(level !== "locked");
        expect(canManageSection(role, section)).toBe(level === "manage");
      });
    }
  }

  it("never lets a role manage what it cannot view", () => {
    for (const role of ROLES) {
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

  it("lets the assistant change a vehicle's driver because it edits vehicles", () => {
    expect(canAssignDrivers("assistant")).toBe(true);
  });
});

describe("homePath", () => {
  it("sends each role to its first visible section", () => {
    expect(homePath("admin")).toBe("/");
    expect(homePath("staff")).toBe("/flota");
    expect(homePath("assistant")).toBe("/");
    expect(homePath("superadmin")).toBe("/");
    expect(homePath("dispatcher")).toBe("/entregas");
    expect(homePath("loader")).toBe("/cargues");
  });
});

describe("vehicle capabilities", () => {
  it("lets only admins sell and transfer vehicles", () => {
    expect(canTransferVehicles("admin")).toBe(true);
    expect(canTransferVehicles("assistant")).toBe(false);
    expect(canTransferVehicles("staff")).toBe(false);
  });

  it("lets the superadmin do every fleet write", () => {
    expect(canTransferVehicles("superadmin")).toBe(true);
    expect(canEditVehicles("superadmin")).toBe(true);
    expect(canDeleteVehicles("superadmin")).toBe(true);
    expect(canManageVehicleFiles("superadmin")).toBe(true);
    expect(canAssignDrivers("superadmin")).toBe(true);
    expect(canManageDrivers("superadmin")).toBe(true);
    expect(canManageTrips("superadmin")).toBe(true);
  });

  it.each<Role>(["dispatcher", "loader"])("gives %s no fleet capability", (role) => {
    expect(canTransferVehicles(role)).toBe(false);
    expect(canEditVehicles(role)).toBe(false);
    expect(canDeleteVehicles(role)).toBe(false);
    expect(canManageVehicleFiles(role)).toBe(false);
    expect(canAssignDrivers(role)).toBe(false);
  });

  it("lets admins and assistants create and edit vehicles, but not staff", () => {
    expect(canEditVehicles("admin")).toBe(true);
    expect(canEditVehicles("assistant")).toBe(true);
    expect(canEditVehicles("staff")).toBe(false);
  });

  it("lets only admins delete vehicles", () => {
    expect(canDeleteVehicles("admin")).toBe(true);
    expect(canDeleteVehicles("assistant")).toBe(false);
    expect(canDeleteVehicles("staff")).toBe(false);
  });

  it("lets admins and assistants upload, replace and delete vehicle files", () => {
    expect(canManageVehicleFiles("admin")).toBe(true);
    expect(canManageVehicleFiles("assistant")).toBe(true);
    expect(canManageVehicleFiles("staff")).toBe(false);
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
    expect(sectionOfPath("/parte-diario")).toBe("inspections");
    expect(sectionOfPath("/viajes")).toBe("trips");
    expect(sectionOfPath("/propietarios")).toBe("owners");
    expect(sectionOfPath("/ventas")).toBe("sales");
    expect(sectionOfPath("/clientes")).toBe("clients");
    expect(sectionOfPath("/entregas")).toBe("deliveries");
    expect(sectionOfPath("/cargues")).toBe("loads");
    expect(sectionOfPath("/pedidos")).toBe("orders");
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
    for (const role of ROLES) {
      expect(canManageDrivers(role)).toBe(canManageSection(role, "drivers"));
    }
  });
});

describe("canManageTrips", () => {
  it("allows only staff to create, edit and delete trips; an admin just reads them", () => {
    expect(canManageTrips("staff")).toBe(true);
    expect(canManageTrips("admin")).toBe(false);
    expect(canManageTrips("assistant")).toBe(false);
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

describe("commercial sections", () => {
  it("lets the dispatcher manage clients, deliveries and orders but only read loads", () => {
    expect(canManageSection("dispatcher", "clients")).toBe(true);
    expect(canManageSection("dispatcher", "deliveries")).toBe(true);
    expect(canManageSection("dispatcher", "orders")).toBe(true);
    expect(canViewSection("dispatcher", "loads")).toBe(true);
    expect(canManageSection("dispatcher", "loads")).toBe(false);
  });

  it("lets the loader manage clients and loads, only read orders and deliveries", () => {
    expect(canManageSection("loader", "clients")).toBe(true);
    expect(canManageSection("loader", "loads")).toBe(true);
    expect(canViewSection("loader", "orders")).toBe(true);
    expect(canManageSection("loader", "orders")).toBe(false);
    expect(canViewSection("loader", "deliveries")).toBe(true);
    expect(canManageSection("loader", "deliveries")).toBe(false);
  });

  it("lets only the roles that manage orders change the kilograms per bag", () => {
    expect(canSetKgPerBag("dispatcher")).toBe(true);
    expect(canSetKgPerBag("superadmin")).toBe(true);
    for (const role of ["admin", "staff", "assistant", "loader"] as const) {
      expect(canSetKgPerBag(role)).toBe(false);
    }
  });

  it("keeps the whole area closed to the fleet roles and open to the superadmin", () => {
    for (const section of ["clients", "deliveries", "loads", "orders"] as const) {
      expect(canManageSection("superadmin", section)).toBe(true);
      for (const role of ["admin", "staff", "assistant"] as const) {
        expect(canViewSection(role, section)).toBe(false);
      }
    }
  });
});

describe("isCommercialRole", () => {
  it("is true only for the dispatcher and the loader", () => {
    expect(isCommercialRole("dispatcher")).toBe(true);
    expect(isCommercialRole("loader")).toBe(true);
    for (const role of ["admin", "staff", "assistant", "superadmin"] as const) {
      expect(isCommercialRole(role)).toBe(false);
    }
  });
});
