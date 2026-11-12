/**
 * Reads of the petty-cash ledgers. Never cached and never shared: every read re-checks that the
 * session user has petty-cash access and is scoped to that user's own ledgers.
 */
import { requirePettyCash } from "@/lib/session";
import { computeLedgerChain, type LedgerBalance } from "../domain/ledger-balances";
import type { LedgerSheet, OwnerOption, SupplierRow, VehicleOption } from "../domain/petty-cash-rows";
import {
  findLedgerNumber,
  loadLedgerFigures,
  loadLedgerSheet,
  loadOwnerOptions,
  loadReviewCounts,
  loadSuppliers,
  loadVehicleOptions,
} from "../infrastructure/petty-cash-repository";

/** The ledgers of the session user in chronological order, each with its derived balances. */
export async function listLedgerBalances(): Promise<LedgerBalance[]> {
  const session = await requirePettyCash();
  const figures = await loadLedgerFigures(session.user.id);
  return computeLedgerChain(figures.initialBalance, figures.ledgers);
}

/** Expenses still to review per ledger id of the session user. */
export async function listReviewCounts(): Promise<Record<number, number>> {
  const session = await requirePettyCash();
  return loadReviewCounts(session.user.id);
}

/** One ledger of the session user by its own number, with its expenses; null when it does not exist. */
export async function getLedgerSheet(number: number): Promise<LedgerSheet | null> {
  const session = await requirePettyCash();
  return loadLedgerSheet(session.user.id, { number });
}

/** The number of the session user's ledger with this database id (old URLs); null when it is not theirs. */
export async function getLedgerNumberById(id: number): Promise<number | null> {
  const session = await requirePettyCash();
  return findLedgerNumber(session.user.id, id);
}

export async function listSuppliers(): Promise<SupplierRow[]> {
  await requirePettyCash();
  return loadSuppliers();
}

export async function listVehicleOptions(): Promise<VehicleOption[]> {
  await requirePettyCash();
  return loadVehicleOptions();
}

export async function listOwnerOptions(): Promise<OwnerOption[]> {
  await requirePettyCash();
  return loadOwnerOptions();
}
