/**
 * Pure aggregation for the dashboard. Works on a minimal projection of the
 * vehicle grid row, so it needs no database and is trivially testable.
 */
import type { AlertStatus, VehicleStatus } from "@/modules/alerts/domain/alert-status";
import { daysBetween, formatDisplayDate, type IsoDate } from "@/modules/shared/domain/dates";

export type OwnerGroup = "IMPERIO" | "PAEZ" | "THIRD_PARTY";

export interface DashboardRow {
  plate: string;
  className: string;
  ownerName: string | null;
  ownerGroup: OwnerGroup | null;
  vehicleStatus: VehicleStatus;
  soat: { status: AlertStatus; date: IsoDate | null };
  tecno: { status: AlertStatus; date: IsoDate | null };
  policy: { status: AlertStatus; date: IsoDate | null };
  tax: { status: AlertStatus; text: string };
  nextChange: { status: AlertStatus; text: string };
}

export const GROUP_LABELS: Record<OwnerGroup | "NONE", string> = {
  IMPERIO: "Transportes El Imperio",
  PAEZ: "Fabián Páez",
  THIRD_PARTY: "Terceros",
  NONE: "Sin propietario",
};

const isOwnerGroup = (v: string): v is OwnerGroup =>
  v === "IMPERIO" || v === "PAEZ" || v === "THIRD_PARTY";

/** Reads the `grupo` search param; anything unknown means "all". */
export function parseGroupParam(value: string | string[] | undefined): OwnerGroup | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v && isOwnerGroup(v) ? v : null;
}

export function filterByGroup<T extends Pick<DashboardRow, "ownerGroup">>(
  rows: readonly T[],
  group: OwnerGroup | null,
): T[] {
  return group ? rows.filter((r) => r.ownerGroup === group) : [...rows];
}

const notSold = <T extends Pick<DashboardRow, "vehicleStatus">>(rows: readonly T[]) =>
  rows.filter((r) => r.vehicleStatus !== "SOLD");

/* ------------------------------ Attention items ------------------------------ */

export type ItemKind = "SOAT" | "TECNO" | "POLICY" | "TAX" | "OIL";

export interface AttentionItem {
  plate: string;
  kind: ItemKind;
  status: "expired" | "warning";
  /** Days until it expires (negative when overdue); null when there is no date. */
  daysLeft: number | null;
  detail: string;
}

const isAlert = (s: AlertStatus): s is "expired" | "warning" =>
  s === "expired" || s === "warning";

function itemsOf(row: DashboardRow, today: IsoDate): AttentionItem[] {
  if (row.vehicleStatus === "SOLD") return [];
  const out: AttentionItem[] = [];

  const docs: Array<[ItemKind, DashboardRow["soat"]]> = [
    ["SOAT", row.soat],
    ["TECNO", row.tecno],
    ["POLICY", row.policy],
  ];
  for (const [kind, doc] of docs) {
    if (!isAlert(doc.status)) continue;
    out.push({
      plate: row.plate,
      kind,
      status: doc.status,
      daysLeft: doc.date ? daysBetween(today, doc.date) : null,
      detail: doc.date ? formatDisplayDate(doc.date) : "Sin dato",
    });
  }
  if (isAlert(row.tax.status)) {
    out.push({
      plate: row.plate,
      kind: "TAX",
      status: row.tax.status,
      daysLeft: null,
      detail: row.tax.text || "Sin dato",
    });
  }
  if (isAlert(row.nextChange.status)) {
    out.push({
      plate: row.plate,
      kind: "OIL",
      status: row.nextChange.status,
      daysLeft: null,
      detail: row.nextChange.text || "Sin dato",
    });
  }
  return out;
}

const byUrgency = (a: AttentionItem, b: AttentionItem) => {
  if (a.status !== b.status) return a.status === "expired" ? -1 : 1;
  if (a.daysLeft !== b.daysLeft) {
    if (a.daysLeft === null) return 1;
    if (b.daysLeft === null) return -1;
    return a.daysLeft - b.daysLeft;
  }
  return a.plate.localeCompare(b.plate);
};

/** Expired and expiring-soon items of non-sold vehicles, most urgent first. */
export function buildAttentionItems(
  rows: readonly DashboardRow[],
  today: IsoDate,
): AttentionItem[] {
  return rows.flatMap((r) => itemsOf(r, today)).sort(byUrgency);
}

/* ---------------------------------- KPIs ---------------------------------- */

export interface Kpis {
  idle: number;
  inWorkshop: number;
  expiredItems: number;
  expiredVehicles: number;
  warningItems: number;
  warningVehicles: number;
}

export function computeKpis(rows: readonly DashboardRow[], today: IsoDate): Kpis {
  const live = notSold(rows);
  const items = live.flatMap((r) => itemsOf(r, today));
  const vehiclesWith = (status: "expired" | "warning") =>
    new Set(items.filter((i) => i.status === status).map((i) => i.plate)).size;

  return {
    idle: live.filter((r) => r.vehicleStatus === "IDLE").length,
    inWorkshop: live.filter((r) => r.vehicleStatus === "IN_WORKSHOP").length,
    expiredItems: items.filter((i) => i.status === "expired").length,
    expiredVehicles: vehiclesWith("expired"),
    warningItems: items.filter((i) => i.status === "warning").length,
    warningVehicles: vehiclesWith("warning"),
  };
}

