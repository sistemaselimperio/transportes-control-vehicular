import type { OwnerGroup } from "@/modules/dashboard/domain/dashboard-metrics";
import type { IsoDate } from "@/modules/shared/domain/dates";

export interface SaleRow {
  id: number;
  plate: string;
  className: string;
  /** Null when the sale date is unknown (e.g. imported from the old Excel). */
  date: IsoDate | null;
  buyer: string | null;
  price: number | null;
  notes: string | null;
  /** Owner the vehicle had when it was sold. */
  previousOwner: string | null;
  previousOwnerGroup: OwnerGroup | null;
}

/** One ownership period of a vehicle, with its owner resolved. */
export interface OwnershipPeriod {
  id: number;
  ownerName: string;
  group: OwnerGroup;
  fromDate: IsoDate;
  toDate: IsoDate | null;
}

/** "ALL", "sin-fecha" (no sale date) or a four-digit year such as "2024". */
export type YearFilter = string;

export const ALL_YEARS = "ALL";
export const NO_DATE = "sin-fecha";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads the `anio` search param; anything unknown means "all". */
export function parseYearParam(value: string | string[] | undefined): YearFilter {
  const v = first(value);
  return v === NO_DATE || (v !== undefined && /^\d{4}$/.test(v)) ? v : ALL_YEARS;
}

const yearOf = (row: Pick<SaleRow, "date">) => row.date?.slice(0, 4) ?? null;

/** Newest sale first; sales without a date go last. */
export function sortSaleRows<T extends Pick<SaleRow, "id" | "date">>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) {
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return a.date < b.date ? 1 : -1;
    }
    return b.id - a.id;
  });
}

/** Years that have at least one sale, newest first. */
export function saleYears(rows: readonly SaleRow[]): string[] {
  const years = new Set<string>();
  for (const r of rows) {
    const y = yearOf(r);
    if (y) years.add(y);
  }
  return [...years].sort().reverse();
}

/** A year (or "sin-fecha") nobody sold in falls back to every sale. */
export function resolveYear(year: YearFilter, rows: readonly SaleRow[]): YearFilter {
  if (year === ALL_YEARS) return year;
  const present = year === NO_DATE ? rows.some((r) => r.date === null) : saleYears(rows).includes(year);
  return present ? year : ALL_YEARS;
}

/** Plates and buyers are compared without case, accents, spaces or dashes ("abc-12" finds "ABC123"). */
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[\s-]/g, "");

export function filterSales(
  rows: readonly SaleRow[],
  filters: { year: YearFilter; query: string },
): SaleRow[] {
  const query = normalize(filters.query);
  return rows.filter((r) => {
    if (filters.year === NO_DATE ? r.date !== null : filters.year !== ALL_YEARS && yearOf(r) !== filters.year) {
      return false;
    }
    return !query || normalize(r.plate).includes(query) || normalize(r.buyer ?? "").includes(query);
  });
}

export function countByYear(rows: readonly SaleRow[]): Record<string, number> {
  const out: Record<string, number> = { [ALL_YEARS]: rows.length };
  for (const r of rows) {
    const key = yearOf(r) ?? NO_DATE;
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export function filterSalesByGroup<T extends Pick<SaleRow, "previousOwnerGroup">>(
  rows: readonly T[],
  group: OwnerGroup | null,
): T[] {
  return group ? rows.filter((r) => r.previousOwnerGroup === group) : [...rows];
}

export function summarizeSales(rows: readonly Pick<SaleRow, "price">[]): {
  count: number;
  total: number;
  withoutPrice: number;
} {
  let total = 0;
  let withoutPrice = 0;
  for (const r of rows) {
    if (r.price === null) withoutPrice += 1;
    else total += r.price;
  }
  return { count: rows.length, total, withoutPrice };
}

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export const formatPrice = (price: number) => pesos.format(price);

/**
 * The owner the vehicle had at the sale: the ownership that covers the date,
 * or, when none does (unknown date, imported history), the one closed latest.
 */
export function previousOwnerAtSale(
  date: IsoDate | null,
  periods: readonly OwnershipPeriod[],
): OwnershipPeriod | null {
  const byRecency = (a: OwnershipPeriod, b: OwnershipPeriod) =>
    a.fromDate === b.fromDate ? b.id - a.id : a.fromDate < b.fromDate ? 1 : -1;

  if (date) {
    const covering = periods
      .filter((p) => p.fromDate <= date && (p.toDate === null || p.toDate >= date))
      .sort(byRecency);
    if (covering[0]) return covering[0];
  }

  const open = "9999-12-31";
  const closedLast = [...periods].sort((a, b) => {
    const ta = a.toDate ?? open;
    const tb = b.toDate ?? open;
    return ta === tb ? byRecency(a, b) : ta < tb ? 1 : -1;
  });
  return closedLast[0] ?? null;
}
