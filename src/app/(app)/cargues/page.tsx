import { canManageSection } from "@/lib/permissions";
import { requireSectionAccess } from "@/lib/session";
import { listLoadRows } from "@/modules/loads/application/load-queries";
import { LoadsView } from "@/modules/loads/ui/loads-view";
import { listDispatchPlates } from "@/modules/vehicles/application/vehicle-queries";

export default async function Page() {
  const role = await requireSectionAccess("loads");
  // The plate list is a shared fleet read, not the fleet section: the commercial role needs no fleet access for it.
  const [rows, plates] = await Promise.all([listLoadRows(), listDispatchPlates()]);
  return <LoadsView rows={rows} plates={plates} canManage={canManageSection(role, "loads")} />;
}
