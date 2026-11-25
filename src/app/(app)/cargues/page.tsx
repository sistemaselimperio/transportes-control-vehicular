import { canManageSection } from "@/lib/permissions";
import { requireSectionAccess } from "@/lib/session";
import { listLoadRows } from "@/modules/loads/application/load-queries";
import { LoadsView } from "@/modules/loads/ui/loads-view";
import { getKgPerBag, listOrderRows } from "@/modules/orders/application/order-queries";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { listDispatchPlates } from "@/modules/vehicles/application/vehicle-queries";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const role = await requireSectionAccess("loads");
  const { nuevo, pedido } = await searchParams;
  // The plate list is a shared fleet read, not the fleet section: the commercial role needs no fleet access for it.
  const [rows, plates, orders, kgPerBag] = await Promise.all([
    listLoadRows(),
    listDispatchPlates(),
    listOrderRows(),
    getKgPerBag(),
  ]);
  const canManage = canManageSection(role, "loads");
  // "Crear cargue" on an order lands here: open the load form of that order, which covers all its pending suppliers.
  const presetId = Number(typeof pedido === "string" ? pedido : "");
  const presetOrder = canManage && nuevo === "1" ? orders.find((o) => o.id === presetId && o.status === "pendiente") : undefined;
  return (
    <LoadsView
      rows={rows}
      plates={plates}
      // Only what a load can still pick up, plus what loads already hold (to edit them).
      orders={orders.filter((o) => o.status !== "anulado")}
      kgPerBag={kgPerBag}
      presetOrderId={presetOrder?.id ?? null}
      canManage={canManage}
      today={todayInBogota()}
    />
  );
}
