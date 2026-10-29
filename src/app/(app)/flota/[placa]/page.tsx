import { notFound } from "next/navigation";
import { currentDay } from "@/lib/current-day";
import { canWrite } from "@/lib/permissions";
import { requireSectionAccess } from "@/lib/session";
import { getVehicleDetail } from "@/modules/vehicles/application/vehicle-queries";
import { VehicleDetailView } from "@/modules/vehicles/ui/vehicle-detail-view";

export default async function Page({
  params,
}: {
  params: Promise<{ placa: string }>;
}) {
  const role = await requireSectionAccess("fleet");
  const { placa } = await params;
  const detail = await getVehicleDetail(decodeURIComponent(placa).toUpperCase(), await currentDay());
  if (!detail) notFound();
  return <VehicleDetailView detail={detail} readOnly={!canWrite(role)} />;
}
