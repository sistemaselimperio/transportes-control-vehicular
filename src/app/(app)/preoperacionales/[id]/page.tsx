import { notFound } from "next/navigation";
import { canWrite } from "@/lib/permissions";
import { requireSectionAccess } from "@/lib/session";
import { bogotaDateTime } from "@/modules/inspections/domain/preoperational-inspection";
import { findInspection } from "@/modules/inspections/infrastructure/inspection-repository";
import { InspectionSheet } from "@/modules/inspections/ui/inspection-sheet";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const role = await requireSectionAccess("inspections");
  const { id } = await params;
  // Anything that is not a UUID cannot exist; skip the query (Postgres would reject the cast).
  const inspection = UUID.test(id) ? await findInspection(id) : null;
  if (!inspection) notFound();
  return <InspectionSheet inspection={inspection} canDecide={canWrite(role)} defaults={bogotaDateTime(new Date())} />;
}
