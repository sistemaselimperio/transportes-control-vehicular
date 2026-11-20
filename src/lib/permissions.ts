/**
 * Who may do what. Pure policy, shared by the server (pages, actions, routes) and the UI.
 *
 * One matrix (`ACCESS`) decides everything. Per section a role has one of three levels:
 * `manage` (create, edit, delete and every other write), `read` (view only: write controls are
 * hidden and the server rejects the writes) or no entry (locked: the page redirects to `homePath`
 * and the sidebar shows the item disabled).
 *
 *   section        admin (Rocio)   staff (Leidy)   assistant (Gabriella)   superadmin   dispatcher (Sandra)   loader (Esperanza)
 *   today/Alertas  read            locked          read                    manage       locked                  locked
 *   fleet          manage          read (+ driver) read (+ create/edit vehicles, driver and files; no delete, sell or transfer)   manage   locked                  locked
 *   drivers        manage          manage          read                    manage       locked                  locked
 *   inspections    manage          read            read                    manage       locked                  locked
 *   trips          read            manage          read                    manage       locked                  locked
 *   logbook        manage          locked          locked                  manage       locked                  locked
 *   owners         manage          read            locked                  manage       locked                  locked
 *   sales          manage          locked          locked                  manage       locked                  locked
 *   clients        locked          locked          locked                  manage       manage                manage
 *   deliveries     locked          locked          locked                  manage       manage                 locked
 *   loads          locked          locked          locked                  manage       locked                  manage
 *
 * The superadmin manages every section, so it also passes every fine-grained fleet capability below.
 * The commercial sections belong to the superadmin and two commercial roles: the dispatcher (clients and
 * deliveries) and the loader (clients and loads). Each is locked out of the other's section.
 *
 * Fleet writes are finer than the matrix: `canEditVehicles`, `canDeleteVehicles` and
 * `canManageVehicleFiles` and `canTransferVehicles` (sell, transfer owner) say who may do each one.
 * Changing a vehicle's driver (`canAssignDrivers`) is open to whoever manages drivers or edits vehicles.
 *
 * The public pre-operational form (/preoperacional) is outside every section.
 */
export type Role = "admin" | "staff" | "assistant" | "superadmin" | "dispatcher" | "loader";

export type Section =
  | "today"
  | "fleet"
  | "drivers"
  | "inspections"
  | "trips"
  | "logbook"
  | "owners"
  | "sales"
  | "clients"
  | "deliveries"
  | "loads";

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
  assistant: {
    today: "read",
    fleet: "read",
    drivers: "read",
    inspections: "read",
    trips: "read",
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
  },
  dispatcher: {
    clients: "manage",
    deliveries: "manage",
  },
  loader: {
    clients: "manage",
    loads: "manage",
  },
};

const SECTION_PATHS: ReadonlyArray<readonly [Section, string]> = [
  ["fleet", "/flota"],
  ["drivers", "/conductores"],
  ["inspections", "/preoperacionales"],
  ["inspections", "/parte-diario"],
  ["trips", "/viajes"],
  ["logbook", "/bitacora"],
  ["owners", "/propietarios"],
  ["sales", "/ventas"],
  ["clients", "/clientes"],
  ["deliveries", "/entregas"],
  ["loads", "/cargues"],
];

/** Anything that is not exactly a known role is the least privileged one. */
export function parseRole(value: unknown): Role {
  return value === "admin" ||
    value === "assistant" ||
    value === "superadmin" ||
    value === "dispatcher" ||
    value === "loader"
    ? value
    : "staff";
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

/** Sell or transfer the ownership of a vehicle: admin only. */
export function canTransferVehicles(role: Role): boolean {
  return canManageSection(role, "fleet");
}

/** Change which driver a vehicle has: open to anyone who sees the fleet and either manages drivers or edits vehicles. */
export function canAssignDrivers(role: Role): boolean {
  return canViewSection(role, "fleet") && (canManageDrivers(role) || canEditVehicles(role));
}

/** Create vehicles and edit everything on a vehicle's file. The assistant does it with only read access to the fleet. */
export function canEditVehicles(role: Role): boolean {
  return canManageSection(role, "fleet") || role === "assistant";
}

/** Delete vehicles (one, several or all): only whoever fully manages the fleet. */
export function canDeleteVehicles(role: Role): boolean {
  return canManageSection(role, "fleet");
}

/** Upload, replace and delete a vehicle's files. */
export function canManageVehicleFiles(role: Role): boolean {
  return canEditVehicles(role);
}

/**
 * Petty cash (caja) is outside the role matrix: only users flagged with `hasPettyCash`
 * (a column on the user) see or use it, whatever their role. Closed for anything but `true`.
 */
export function canUsePettyCash(flag: unknown): boolean {
  return flag === true;
}

/** The first section the role can see: where a redirect from a forbidden page lands. */
export function homePath(role: Role): string {
  if (canViewSection(role, "today")) return "/";
  if (canViewSection(role, "fleet")) return "/flota";
  if (canViewSection(role, "deliveries")) return "/entregas";
  if (canViewSection(role, "loads")) return "/cargues";
  return "/clientes";
}

/** The roles of the commercial area (the dispatcher and the loader): they work under the logistics brand. */
export function isCommercialRole(role: Role): boolean {
  return role === "dispatcher" || role === "loader";
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
