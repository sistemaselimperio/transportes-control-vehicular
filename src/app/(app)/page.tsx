import { canEditVehicles, receivesParkedTripAlerts } from "@/lib/permissions";
import { getRequestSession, requireSectionAccess } from "@/lib/session";
import {
  parseKindParam,
  parseQueryParam,
  parseStatusParam,
} from "@/modules/alerts/domain/alert-filters";
import { getDashboard, getParkedTripWarnings } from "@/modules/dashboard/application/dashboard-queries";
import { filterByGroup, parseGroupParam } from "@/modules/dashboard/domain/dashboard-metrics";
import { TodayView } from "@/modules/today/ui/today-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const role = await requireSectionAccess("today");
  const { grupo, tipo, estado, placa } = await searchParams;
  const group = parseGroupParam(grupo);
  const data = await getDashboard(group);
  // Only users flagged to receive them are warned about trips programmed on a parked vehicle.
  const session = await getRequestSession();
  const parkedTrips = receivesParkedTripAlerts(session?.user.receivesParkedTripAlerts)
    ? filterByGroup(await getParkedTripWarnings(), group)
    : [];
  return (
    <TodayView
      data={data}
      parkedTrips={parkedTrips}
      canEditVehicles={canEditVehicles(role)}
      initialKind={parseKindParam(tipo)}
      initialStatus={parseStatusParam(estado)}
      initialQuery={parseQueryParam(placa)}
    />
  );
}
