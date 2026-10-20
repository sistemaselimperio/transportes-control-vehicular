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

const collator = new Intl.Collator("es", { sensitivity: "base" });

export function sortDriverRows<T extends Pick<DriverRow, "name">>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => collator.compare(a.name, b.name));
}
