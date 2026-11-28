import { notFound } from "next/navigation";
import { currentDay } from "@/lib/current-day";
import { canAssignDrivers, canEditVehicleCapacity, canEditVehicles, canManageSection, canManageVehicleFiles, canTransferVehicles, canViewSection } from "@/lib/permissions";
import { requireSectionAccess } from "@/lib/session";
import { listTrailerTireEvents } from "@/modules/trailer-tires/infrastructure/tire-event-repository";
import { isTrailerClass } from "@/modules/vehicles/domain/trailer";
import { listVehicleDailyReports, listVehicleInspections } from "@/modules/inspections/infrastructure/inspection-repository";
import { getVehicleDetail } from "@/modules/vehicles/application/vehicle-queries";
import { HISTORY_LIMIT, parseHistoryTab } from "@/modules/vehicles/domain/history-tab";
import { normalizePlate } from "@/modules/vehicles/domain/plate";
import { VehicleDetailView } from "@/modules/vehicles/ui/vehicle-detail-view";

function canonicalPlate(raw: string): string {
  try {
    return normalizePlate(raw);
  } catch {
    return raw.toUpperCase();
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ placa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const role = await requireSectionAccess("fleet");
  const [{ placa }, query] = await Promise.all([params, searchParams]);
  // Normalized, so links saved with an older format ("EMS44E") still open the file ("EMS-44E").
  const detail = await getVehicleDetail(canonicalPlate(decodeURIComponent(placa)), await currentDay());
  if (!detail) notFound();
  // Inspections arrive from a public form, so no write path of the app expires them: read per request.
  // Tire events of a trailer are read per request too, so an edit shows up at once.
  const [inspections, dailyReports, tireEvents] = await Promise.all([
    listVehicleInspections(detail.row.id, HISTORY_LIMIT),
    listVehicleDailyReports(detail.row.id, HISTORY_LIMIT),
    isTrailerClass(detail.row.className ?? "") ? listTrailerTireEvents(detail.row.id) : Promise.resolve([]),
  ]);
  return (
    <VehicleDetailView
      detail={detail}
      readOnly={!canEditVehicles(role)}
      filesReadOnly={!canManageVehicleFiles(role)}
      canOpenLogbook={canViewSection(role, "logbook")}
      allowed={[...(canAssignDrivers(role) ? (["driver"] as const) : []), ...(canEditVehicleCapacity(role) ? (["capacity"] as const) : [])]}
      denied={canTransferVehicles(role) ? [] : ["owner", "sell"]}
      inspections={inspections}
      dailyReports={dailyReports}
      historyTab={parseHistoryTab(query.historial)}
      tireEvents={tireEvents}
      canEditTires={canManageSection(role, "logbook")}
    />
  );
}
