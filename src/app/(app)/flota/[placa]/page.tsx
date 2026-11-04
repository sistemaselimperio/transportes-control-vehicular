import { notFound } from "next/navigation";
import { currentDay } from "@/lib/current-day";
import { canAssignDrivers, canManageSection } from "@/lib/permissions";
import { requireSectionAccess } from "@/lib/session";
import { listVehicleInspections } from "@/modules/inspections/infrastructure/inspection-repository";
import { listVehicleTrips } from "@/modules/trips/application/trip-queries";
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
  const [inspections, trips] = await Promise.all([
    listVehicleInspections(detail.row.id, HISTORY_LIMIT),
    listVehicleTrips(detail.row.id, HISTORY_LIMIT),
  ]);
  return (
    <VehicleDetailView
      detail={detail}
      readOnly={!canManageSection(role, "fleet")}
      allowed={canAssignDrivers(role) ? ["driver"] : []}
      inspections={inspections}
      trips={trips}
      historyTab={parseHistoryTab(query.historial)}
    />
  );
}
