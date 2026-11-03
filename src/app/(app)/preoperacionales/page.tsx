import { requireSectionAccess } from "@/lib/session";
import { parseInspectionFilters } from "@/modules/inspections/domain/inspection-filters";
import { listInspections } from "@/modules/inspections/infrastructure/inspection-repository";
import { InspectionsView } from "@/modules/inspections/ui/inspections-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSectionAccess("inspections");
  const filters = parseInspectionFilters(await searchParams);
  const { rows, hasNext } = await listInspections(filters);
  return <InspectionsView rows={rows} filters={filters} hasNext={hasNext} />;
}
