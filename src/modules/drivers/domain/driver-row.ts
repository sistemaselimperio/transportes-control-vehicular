import type { OwnerGroup } from "@/modules/dashboard/domain/dashboard-metrics";

export type DriverStatus = "ACTIVE" | "IN_WORKSHOP" | "INACTIVE";

export interface DriverRow {
  id: number;
  name: string;
  nationalId: string | null;
  phone: string | null;
  company: OwnerGroup | null;
  status: DriverStatus;
  /** Plates of the vehicles currently assigned to the driver. */
  plates: string[];
}

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  ACTIVE: "Activo",
  IN_WORKSHOP: "Taller",
  INACTIVE: "Inactivo",
};

export const COMPANY_LABELS: Record<OwnerGroup, string> = {
  IMPERIO: "Transportes El Imperio",
  PAEZ: "Fabián Páez",
  THIRD_PARTY: "Terceros",
};

export function filterDriversByCompany<T extends Pick<DriverRow, "company">>(
  rows: readonly T[],
  group: OwnerGroup | null,
): T[] {
  return group ? rows.filter((r) => r.company === group) : [...rows];
}

/** Lowercase, without accents, spaces or punctuation: "JSL-978" and "jsl 978" compare equal. */
const searchKey = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]/g, "");

/**
 * Rows where every word of the query appears in the name, national id, phone or one of the
 * plates, ignoring case, accents and dashes. A blank query keeps every row.
 */
export function searchDrivers<T extends Pick<DriverRow, "name" | "nationalId" | "phone" | "plates">>(
  rows: readonly T[],
  query: string,
): T[] {
  const words = query.split(/\s+/).map(searchKey).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((r) => {
    const fields = [r.name, r.nationalId ?? "", r.phone ?? "", ...r.plates].map(searchKey);
    return words.every((w) => fields.some((f) => f.includes(w)));
  });
}

const collator = new Intl.Collator("es", { sensitivity: "base" });

export function sortDriverRows<T extends Pick<DriverRow, "name">>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => collator.compare(a.name, b.name));
}
