/**
 * Who may do what. Pure policy, shared by the server (pages, actions, routes) and the UI.
 * `admin` can do everything; `staff` can read the fleet (list, file, documents, logbook of a
 * vehicle), open vehicle files, and manage the drivers (create, edit, delete); nothing else is
 * writable for them.
 */
export type Role = "admin" | "staff";

export type Section = "today" | "fleet" | "drivers" | "logbook" | "owners" | "sales";

const STAFF_SECTIONS: ReadonlySet<Section> = new Set(["fleet", "drivers"]);

const SECTION_PATHS: ReadonlyArray<readonly [Section, string]> = [
  ["fleet", "/flota"],
  ["drivers", "/conductores"],
  ["logbook", "/bitacora"],
  ["owners", "/propietarios"],
  ["sales", "/ventas"],
];

/** Anything that is not exactly a known role is the least privileged one. */
export function parseRole(value: unknown): Role {
  return value === "admin" ? "admin" : "staff";
}

export function canViewSection(role: Role, section: Section): boolean {
  return role === "admin" || STAFF_SECTIONS.has(section);
}

/** Create, edit, delete, upload and import. */
export function canWrite(role: Role): boolean {
  return role === "admin";
}

/** Create, edit and delete drivers: the one write staff also has. */
export function canManageDrivers(role: Role): boolean {
  return role === "admin" || role === "staff";
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
