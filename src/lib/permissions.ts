/**
 * Who may do what. Pure policy, shared by the server (pages, actions, routes) and the UI.
 *
 * One matrix (`ACCESS`) decides everything. Per section a role has one of three levels:
 * `manage` (create, edit, delete and every other write), `read` (view only: write controls are
 * hidden and the server rejects the writes) or no entry (locked: the page redirects to `homePath`
 * and the sidebar shows the item disabled).
 *
 *   section        admin (Rocio)   staff (Leidy)
 *   today/Alertas  read            locked
 *   fleet          manage          read (+ changing a vehicle's driver)
 *   drivers        manage          manage
 *   inspections    manage          read
 *   trips          read            manage
 *   logbook        manage          locked
 *   owners         manage          read
 *   sales          manage          locked
 *
 * The public pre-operational form (/preoperacional) is outside every section.
 */
export type Role = "admin" | "staff";

export type Section = "today" | "fleet" | "drivers" | "inspections" | "trips" | "logbook" | "owners" | "sales";

export type Access = "read" | "manage";

const ACCESS: Readonly<Record<Role, Readonly<Partial<Record<Section, Access>>>>> = {
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
    fleet: "read",
    drivers: "manage",
    inspections: "read",
    trips: "manage",
    owners: "read",
  },
};

const SECTION_PATHS: ReadonlyArray<readonly [Section, string]> = [
  ["fleet", "/flota"],
  ["drivers", "/conductores"],
  ["inspections", "/preoperacionales"],
  ["trips", "/viajes"],
  ["logbook", "/bitacora"],
  ["owners", "/propietarios"],
  ["sales", "/ventas"],
];

/** Anything that is not exactly a known role is the least privileged one. */
export function parseRole(value: unknown): Role {
  return value === "admin" ? "admin" : "staff";
}

/** The role's level on a section, `null` when the section is locked for it. */
export function accessOf(role: Role, section: Section): Access | null {
  return ACCESS[role][section] ?? null;
}

/** Read or manage: the role may open the section's pages. */
export function canViewSection(role: Role, section: Section): boolean {
  return accessOf(role, section) !== null;
}

/** Create, edit, delete and every other write of a section. */
export function canManageSection(role: Role, section: Section): boolean {
  return accessOf(role, section) === "manage";
}

/** Create, edit and delete drivers. */
export function canManageDrivers(role: Role): boolean {
  return canManageSection(role, "drivers");
}

/** Create, edit and delete trips. */
export function canManageTrips(role: Role): boolean {
  return canManageSection(role, "trips");
}

/** Change which driver a vehicle has: the one fleet write open to anyone who sees the fleet and manages drivers. */
export function canAssignDrivers(role: Role): boolean {
  return canViewSection(role, "fleet") && canManageDrivers(role);
}

/** The first section the role can see: where a redirect from a forbidden page lands. */
export function homePath(role: Role): string {
  return role === "admin" ? "/" : "/flota";
}

export function sectionOfPath(pathname: string): Section | null {
  if (pathname === "/") return "today";
  const match = SECTION_PATHS.find(([, base]) => pathname === base || pathname.startsWith(`${base}/`));
  return match ? match[0] : null;
}

/** Thrown by the server guards when the signed-in user's role does not allow the operation. */
export class ForbiddenError extends Error {
  constructor(message = "No tienes permiso para realizar esta acción.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
