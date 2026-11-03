import { notFound } from "next/navigation";
import { currentDay } from "@/lib/current-day";
import { canAssignDrivers, canWrite } from "@/lib/permissions";
import { requireSectionAccess } from "@/lib/session";
import { listVehicleInspections } from "@/modules/inspections/infrastructure/inspection-repository";
import { getVehicleDetail } from "@/modules/vehicles/application/vehicle-queries";
import { VehicleDetailView } from "@/modules/vehicles/ui/vehicle-detail-view";

const INSPECTIONS_LIMIT = 20;

export default async function Page({
  params,
}: {
  params: Promise<{ placa: string }>;
}) {
  const role = await requireSectionAccess("fleet");
  const { placa } = await params;
  const detail = await getVehicleDetail(decodeURIComponent(placa).toUpperCase(), await currentDay());
  if (!detail) notFound();
  // Per request and uncached: inspections arrive from a public form, so no write path of the app expires them.
  const inspections = await listVehicleInspections(detail.row.id, INSPECTIONS_LIMIT);
  return (
    <VehicleDetailView
      detail={detail}
      readOnly={!canWrite(role)}
      allowed={canAssignDrivers(role) ? ["driver"] : []}
      inspections={inspections}
      inspectionsLimit={INSPECTIONS_LIMIT}
    />
  );
}
