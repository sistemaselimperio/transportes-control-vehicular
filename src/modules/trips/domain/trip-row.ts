import { normalizePlate } from "@/modules/vehicles/domain/plate";
import type { TripArea } from "./trip-areas";
import type { TripStatus } from "./trip-status";

export interface TripRow {
  id: number;
  /** ISO instant. */
  startAt: string;
  destination: string;
  /** Plate as it was when the trip was saved; stays even if the vehicle is deleted. */
  plate: string;
  /** Null once the vehicle was deleted. */
  vehicleId: number | null;
  area: TripArea;
  status: TripStatus;
}

export interface TripFilters {
  status: TripStatus | "ALL";
  area: TripArea | "ALL";
  query: string;
}

/** Newest start first; the newest id breaks ties. */
export function sortTrips<T extends Pick<TripRow, "id" | "startAt">>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const byStart = Date.parse(b.startAt) - Date.parse(a.startAt);
    return byStart !== 0 ? byStart : b.id - a.id;
  });
}

/** Lowercase, without accents, spaces or punctuation: "ABC-123" and "abc 123" compare equal. */
const searchKey = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]/g, "");

/** Rows matching the status and area filters and every word of the query in the plate or destination. */
export function filterTrips<T extends Pick<TripRow, "status" | "area" | "plate" | "destination">>(
  rows: readonly T[],
  filters: TripFilters,
): T[] {
  const words = filters.query.split(/\s+/).map(searchKey).filter(Boolean);
  return rows.filter((r) => {
    if (filters.status !== "ALL" && r.status !== filters.status) return false;
    if (filters.area !== "ALL" && r.area !== filters.area) return false;
    const fields = [r.plate, r.destination].map(searchKey);
    return words.every((w) => fields.some((f) => f.includes(w)));
  });
}

const collator = new Intl.Collator("es", { sensitivity: "base" });

/** Distinct destinations already used, A to Z: the suggestions of the form. */
export function suggestDestinations(rows: readonly Pick<TripRow, "destination">[]): string[] {
  return [...new Set(rows.map((r) => r.destination))].sort(collator.compare);
}

/** The canonical plate in a `placa` search param, or "" when it is missing or blank. */
export function parsePlateParam(value: string | string[] | undefined): string {
  const raw = (Array.isArray(value) ? value[0] : value) ?? "";
  return raw.trim() === "" ? "" : normalizePlate(raw);
}
