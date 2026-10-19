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
  /** Sale date for sold vehicles; null when unknown or not sold. */
  soldOn: IsoDate | null;
}

export const GROUP_LABELS: Record<OwnerGroup | "NONE", string> = {
  IMPERIO: "Transportes El Imperio",
  PAEZ: "Fabián y Sandra Páez",
  THIRD_PARTY: "Terceros",
  NONE: "Sin propietario",
};

const GROUP_ORDER: Array<OwnerGroup | "NONE"> = ["IMPERIO", "PAEZ", "THIRD_PARTY", "NONE"];

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
  activeFleet: number;
  /** Everything that is not sold. */
  fleetTotal: number;
  idle: number;
  inWorkshop: number;
  expiredItems: number;
  expiredVehicles: number;
  warningItems: number;
  warningVehicles: number;
  soldThisYear: number;
}

export function computeKpis(rows: readonly DashboardRow[], today: IsoDate): Kpis {
  const year = today.slice(0, 4);
  const live = notSold(rows);
  const items = live.flatMap((r) => itemsOf(r, today));
  const vehiclesWith = (status: "expired" | "warning") =>
    new Set(items.filter((i) => i.status === status).map((i) => i.plate)).size;

  return {
    activeFleet: live.filter((r) => r.vehicleStatus === "ACTIVE").length,
    fleetTotal: live.length,
    idle: live.filter((r) => r.vehicleStatus === "IDLE").length,
    inWorkshop: live.filter((r) => r.vehicleStatus === "IN_WORKSHOP").length,
    expiredItems: items.filter((i) => i.status === "expired").length,
    expiredVehicles: vehiclesWith("expired"),
    warningItems: items.filter((i) => i.status === "warning").length,
    warningVehicles: vehiclesWith("warning"),
    soldThisYear: rows.filter(
      (r) => r.vehicleStatus === "SOLD" && r.soldOn?.slice(0, 4) === year,
    ).length,
  };
}

/* ------------------------------- Distributions ------------------------------ */

const byCountThenName = (a: { count: number; name: string }, b: { count: number; name: string }) =>
  b.count - a.count || a.name.localeCompare(b.name, "es");

export function fleetByClass(rows: readonly DashboardRow[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const r of notSold(rows)) counts.set(r.className, (counts.get(r.className) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort(byCountThenName);
}

export function fleetByGroup(
  rows: readonly DashboardRow[],
): Array<{ group: OwnerGroup | "NONE"; label: string; count: number }> {
  const counts = new Map<OwnerGroup | "NONE", number>();
  for (const r of notSold(rows)) {
    const g = r.ownerGroup ?? "NONE";
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return GROUP_ORDER.filter((g) => counts.has(g)).map((g) => ({
    group: g,
    label: GROUP_LABELS[g],
    count: counts.get(g)!,
  }));
}

export interface MigrationProgress {
  total: number;
  imperio: number;
  /** Whole percent of non-sold vehicles owned by Transportes El Imperio. */
  percent: number;
  byOwner: Array<{ ownerName: string; group: OwnerGroup | null; count: number }>;
}

export function migrationProgress(rows: readonly DashboardRow[]): MigrationProgress {
  const live = notSold(rows);
  const owners = new Map<string, { group: OwnerGroup | null; count: number }>();
  for (const r of live) {
    const name = r.ownerName ?? GROUP_LABELS.NONE;
    const entry = owners.get(name) ?? { group: r.ownerGroup, count: 0 };
    entry.count += 1;
    owners.set(name, entry);
  }
  const imperio = live.filter((r) => r.ownerGroup === "IMPERIO").length;
  return {
    total: live.length,
    imperio,
    percent: live.length === 0 ? 0 : Math.round((imperio / live.length) * 100),
    byOwner: [...owners]
      .map(([ownerName, v]) => ({ ownerName, group: v.group, count: v.count }))
      .sort((a, b) => byCountThenName({ count: a.count, name: a.ownerName }, { count: b.count, name: b.ownerName })),
  };
}

/* -------------------------------- Maintenance ------------------------------- */

export interface PendingOil {
  plate: string;
  status: "expired" | "warning";
  detail: string;
}

export function pendingOilChanges(rows: readonly DashboardRow[]): {
  overdue: PendingOil[];
  dueSoon: PendingOil[];
} {
  const all: PendingOil[] = [];
  for (const r of notSold(rows)) {
    if (isAlert(r.nextChange.status)) {
      all.push({ plate: r.plate, status: r.nextChange.status, detail: r.nextChange.text || "Sin dato" });
    }
  }
  all.sort((a, b) => a.plate.localeCompare(b.plate));
  return {
    overdue: all.filter((p) => p.status === "expired"),
    dueSoon: all.filter((p) => p.status === "warning"),
  };
}

/* ----------------------------------- Sales ---------------------------------- */

export const UNDATED_LABEL = "Sin fecha";

export function soldByYear(rows: readonly DashboardRow[]): Array<{ year: string; count: number }> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.vehicleStatus !== "SOLD") continue;
    const year = r.soldOn ? r.soldOn.slice(0, 4) : UNDATED_LABEL;
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => {
      if (a.year === UNDATED_LABEL) return 1;
      if (b.year === UNDATED_LABEL) return -1;
      return a.year.localeCompare(b.year);
    });
}
