import { requireSectionAccess } from "@/lib/session";
import { parseGroupParam } from "@/modules/dashboard/domain/dashboard-metrics";
import { listOwnerRows } from "@/modules/owners/application/owner-queries";
import { filterOwnersByGroup, parseViewParam } from "@/modules/owners/domain/owner-row";
import { OwnersView } from "@/modules/owners/ui/owners-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSectionAccess("owners");
  // Await the request first: the cached read must run per request, never while prerendering.
  const { grupo, vista } = await searchParams;
  const rows = await listOwnerRows();
  const group = parseGroupParam(grupo);
  return <OwnersView rows={filterOwnersByGroup(rows, group)} group={group} initialView={parseViewParam(vista)} />;
}
