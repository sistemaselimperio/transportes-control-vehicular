import { canDeliverOrders, canManageSection, canSetKgPerBag } from "@/lib/permissions";
import { requireSectionAccess } from "@/lib/session";
import { listClientRows } from "@/modules/clients/application/client-queries";
import { listLoadBalances } from "@/modules/loads/application/load-queries";
import { getKgPerBag, listCatalogProducts, listOrderRows } from "@/modules/orders/application/order-queries";
import { OrdersView } from "@/modules/orders/ui/orders-view";
import { todayInBogota } from "@/modules/shared/domain/dates";

export default async function Page() {
  const role = await requireSectionAccess("orders");
  const [rows, clients, references, kgPerBag, balances] = await Promise.all([
    listOrderRows(),
    listClientRows(),
    listCatalogProducts(),
    getKgPerBag(),
    listLoadBalances(),
  ]);
  return (
    <OrdersView
      rows={rows}
      clients={clients.map(({ id, name, nit, locations }) => ({
        id,
        name,
        nit,
        locations: locations.map((l) => ({ id: l.id, name: l.name })),
      }))}
      references={references}
      kgPerBag={kgPerBag}
      canManage={canManageSection(role, "orders")}
      canSetKgPerBag={canSetKgPerBag(role)}
      // The loader only reads orders but may start a load from a pending one.
      canCreateLoad={canManageSection(role, "loads")}
      // The loader reads orders but may deliver them, like the dispatcher and the superadmin.
      canDeliver={canDeliverOrders(role)}
      balances={balances}
      today={todayInBogota()}
    />
  );
}
