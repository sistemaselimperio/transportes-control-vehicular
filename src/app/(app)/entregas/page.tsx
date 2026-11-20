import { canManageSection } from "@/lib/permissions";
import { requireSectionAccess } from "@/lib/session";
import { listClientRows } from "@/modules/clients/application/client-queries";
import { listClientsLastDelivery, listDeliveryRows, listDestinationRows } from "@/modules/deliveries/application/delivery-queries";
import { computeClientAlerts } from "@/modules/deliveries/domain/delivery-rules";
import { parseDeliveryTab } from "@/modules/deliveries/domain/delivery-tabs";
import { DeliveriesView } from "@/modules/deliveries/ui/deliveries-view";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { listDispatchPlates } from "@/modules/vehicles/application/vehicle-queries";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const role = await requireSectionAccess("deliveries");
  // Await the request first: the clock below must be read per request, never while prerendering.
  const { tab } = await searchParams;
  const [rows, clients, destinations, lastDeliveries, plates] = await Promise.all([
    listDeliveryRows(),
    listClientRows(),
    listDestinationRows(),
    listClientsLastDelivery(),
    listDispatchPlates(),
  ]);
  const today = todayInBogota();
  return (
    <DeliveriesView
      rows={rows}
      clients={clients.map(({ id, name, nit, locations }) => ({
        id,
        name,
        nit,
        locations: locations.map((l) => ({ id: l.id, name: l.name })),
      }))}
      destinations={destinations}
      plates={plates}
      alerts={computeClientAlerts(lastDeliveries, today)}
      today={today}
      canManage={canManageSection(role, "deliveries")}
      initialTab={parseDeliveryTab(typeof tab === "string" ? tab : undefined)}
    />
  );
}
