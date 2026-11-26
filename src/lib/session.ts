import { headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAssignDrivers, canDeleteVehicles, canDeliverOrders, canEditVehicleCapacity, canEditVehicles, canManageSection, canManageVehicleFiles, canTransferVehicles, canUseCoteroPayments, canUsePettyCash, canViewSection, ForbiddenError, homePath, parseRole, type Section } from "@/lib/permissions";

/** The session of this request, read once however many components ask. Reads headers: request time only. */
export const getRequestSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Server actions and route handlers are callable directly: always re-check the session. */
export async function requireSession() {
  const session = await getRequestSession();
  if (!session) throw new Error("No autorizado");
  return session;
}

/**
 * Every write goes through a guard like this one: the role must manage the section it writes to
 * (see `ACCESS` in permissions). Throws `ForbiddenError` otherwise.
 */
export async function requireSectionManager(section: Section) {
  const session = await requireSession();
  if (!canManageSection(parseRole(session.user.role), section)) throw new ForbiddenError();
  return session;
}

/** Delivering orders (and undoing it): whoever manages the orders or the loads. Throws `ForbiddenError` otherwise. */
export async function requireOrderDeliverer() {
  const session = await requireSession();
  if (!canDeliverOrders(parseRole(session.user.role))) throw new ForbiddenError();
  return session;
}

/** Driver writes. */
export const requireDriverManager = () => requireSectionManager("drivers");

/** Trip writes. */
export const requireTripManager = () => requireSectionManager("trips");

/** Vehicle create and edit (and everything else on a vehicle's file except deleting it). */
export async function requireVehicleEditor() {
  const session = await requireSession();
  if (!canEditVehicles(parseRole(session.user.role))) throw new ForbiddenError();
  return session;
}

/** Deleting vehicles, one or all. */
export async function requireVehicleDeleter() {
  const session = await requireSession();
  if (!canDeleteVehicles(parseRole(session.user.role))) throw new ForbiddenError();
  return session;
}

/** Uploading, replacing and deleting a vehicle's files. */
export async function requireVehicleFileManager() {
  const session = await requireSession();
  if (!canManageVehicleFiles(parseRole(session.user.role))) throw new ForbiddenError();
  return session;
}

/** Selling or transferring a vehicle. */
export async function requireVehicleTransferer() {
  const session = await requireSession();
  if (!canTransferVehicles(parseRole(session.user.role))) throw new ForbiddenError();
  return session;
}

/** Changing a vehicle's driver: open to anyone who sees the fleet and manages drivers or edits vehicles. Throws `ForbiddenError` otherwise. */
export async function requireDriverAssigner() {
  const session = await requireSession();
  if (!canAssignDrivers(parseRole(session.user.role))) throw new ForbiddenError();
  return session;
}

/** Changing only a vehicle's capacity: staff and whoever edits vehicles. Throws `ForbiddenError` otherwise. */
export async function requireCapacityEditor() {
  const session = await requireSession();
  if (!canEditVehicleCapacity(parseRole(session.user.role))) throw new ForbiddenError();
  return session;
}

/** The role of this request's user, `null` without a session. */
export async function getRequestRole() {
  const session = await getRequestSession();
  return session ? parseRole(session.user.role) : null;
}

/** For pages: sends a signed-out user to the login and a role that cannot see the section to its home. */
export async function requireSectionAccess(section: Section) {
  const role = await getRequestRole();
  if (!role) redirect("/login");
  if (!canViewSection(role, section)) redirect(homePath(role));
  return role;
}

/**
 * Petty-cash reads and writes: only users flagged with `hasPettyCash` (not a role). The flag is read
 * from the stored session user on every call, so it cannot be skipped by calling an action directly.
 * Throws `ForbiddenError` otherwise.
 */
export async function requirePettyCash() {
  const session = await requireSession();
  if (!canUsePettyCash(session.user.hasPettyCash)) throw new ForbiddenError();
  return session;
}

/** For petty-cash pages: sends a signed-out user to the login and anyone without the flag to its home. */
export async function requirePettyCashAccess() {
  const session = await getRequestSession();
  if (!session) redirect("/login");
  if (!canUsePettyCash(session.user.hasPettyCash)) redirect(homePath(parseRole(session.user.role)));
  return session;
}

/**
 * Cotero-payment reads and writes: only users flagged with `hasCoteroPayments` (not a role, and not
 * implied by admin). The flag is read from the stored session user on every call, so it cannot be
 * skipped by calling an action directly. Throws `ForbiddenError` otherwise.
 */
export async function requireCoteroPayments() {
  const session = await requireSession();
  if (!canUseCoteroPayments(session.user.hasCoteroPayments)) throw new ForbiddenError();
  return session;
}

/** For cotero-payment pages: sends a signed-out user to the login and anyone without the flag to its home. */
export async function requireCoteroPaymentsAccess() {
  const session = await getRequestSession();
  if (!session) redirect("/login");
  if (!canUseCoteroPayments(session.user.hasCoteroPayments)) redirect(homePath(parseRole(session.user.role)));
  return session;
}
