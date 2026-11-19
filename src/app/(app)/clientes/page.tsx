import { canManageSection } from "@/lib/permissions";
import { requireSectionAccess } from "@/lib/session";
import { listClientRows } from "@/modules/clients/application/client-queries";
import { ClientsView } from "@/modules/clients/ui/clients-view";

export default async function Page() {
  const role = await requireSectionAccess("clients");
  const rows = await listClientRows();
  return <ClientsView rows={rows} canManage={canManageSection(role, "clients")} />;
}
