import { headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canViewSection, canWrite, ForbiddenError, homePath, parseRole, type Section } from "@/lib/permissions";
import { parseTheme } from "@/lib/theme";

/** The session of this request, read once however many components ask. Reads headers: request time only. */
export const getRequestSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Server actions and route handlers are callable directly: always re-check the session. */
export async function requireSession() {
  const session = await getRequestSession();
  if (!session) throw new Error("No autorizado");
  return session;
}

/** Every write goes through this: staff can read but never change data. Throws `ForbiddenError` for them. */
export async function requireAdmin() {
  const session = await requireSession();
  if (!canWrite(parseRole(session.user.role))) throw new ForbiddenError();
  return session;
}

/** The role of this request's user, `null` without a session. */
export async function getRequestRole() {
  const session = await getRequestSession();
  return session ? parseRole(session.user.role) : null;
}

/** The theme of this request's user, `null` without a session. */
export async function getRequestTheme() {
  const session = await getRequestSession();
  return session ? parseTheme(session.user.theme) : null;
}

/** For pages: sends a signed-out user to the login and a role that cannot see the section to its home. */
export async function requireSectionAccess(section: Section) {
  const role = await getRequestRole();
  if (!role) redirect("/login");
  if (!canViewSection(role, section)) redirect(homePath(role));
  return role;
}
