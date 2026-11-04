import { canManageSection } from "@/lib/permissions";
import { requireSectionAccess } from "@/lib/session";
import { listTripRows } from "@/modules/trips/application/trip-queries";
import { parsePlateParam } from "@/modules/trips/domain/trip-row";
import { listFleetPlates } from "@/modules/vehicles/application/vehicle-queries";
import { TripsView } from "@/modules/trips/ui/trips-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const role = await requireSectionAccess("trips");
  const [rows, plates, query] = await Promise.all([listTripRows(), listFleetPlates(), searchParams]);
  return <TripsView rows={rows} plates={plates} canManage={canManageSection(role, "trips")} initialQuery={parsePlateParam(query.placa)} />;
}
