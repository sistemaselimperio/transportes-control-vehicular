/**
 * Reads of the cotero payments. The data is company-wide, so the rows are cached and tagged (see
 * `readTags`), but the guard runs first on every call: the cache never answers a user without the flag.
 */
import { cacheLife, cacheTag } from "next/cache";
import { readTags } from "@/lib/cache-tags";
import { requireCoteroPayments } from "@/lib/session";
import type { FleetCandidates } from "../domain/fleet-matching";
import type { ReceiptRow } from "../domain/receipt-rules";
import type { CoteroProfileRow, SettlementRow, TariffRow } from "../domain/settlement-rows";
import { loadFleetCandidates, loadProfileRows, loadReceiptRows, loadSettlementRows, loadTariffRows } from "../infrastructure/cotero-repository";

async function cachedReceipts(): Promise<ReceiptRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("coteroReceipts"));

  return loadReceiptRows();
}

async function cachedSettlements(): Promise<SettlementRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("coteroSettlements"));

  return loadSettlementRows();
}

async function cachedTariffs(): Promise<TariffRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("coteroTariffs"));

  return loadTariffRows();
}

async function cachedProfiles(): Promise<CoteroProfileRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("coteroProfiles"));

  return loadProfileRows();
}

async function cachedFleet(): Promise<FleetCandidates> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("coteroFleet"));

  return loadFleetCandidates();
}

/** The active vehicles and drivers a receipt may name; read-only, for anyone with the cotero flag. */
export async function listFleetCandidates(): Promise<FleetCandidates> {
  await requireCoteroPayments();
  return cachedFleet();
}

/** Every receipt, newest day first; filtered on the client. */
export async function listReceiptRows(): Promise<ReceiptRow[]> {
  await requireCoteroPayments();
  return cachedReceipts();
}

/** Every settlement, newest first. */
export async function listSettlementRows(): Promise<SettlementRow[]> {
  await requireCoteroPayments();
  return cachedSettlements();
}

/** Every tariff, latest start first. */
export async function listTariffRows(): Promise<TariffRow[]> {
  await requireCoteroPayments();
  return cachedTariffs();
}

/** What is remembered about each cotero (cédula, how they are paid). */
export async function listProfileRows(): Promise<CoteroProfileRow[]> {
  await requireCoteroPayments();
  return cachedProfiles();
}
