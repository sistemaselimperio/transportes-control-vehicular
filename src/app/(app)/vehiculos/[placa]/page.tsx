import { notFound } from "next/navigation";
import { getVehicleDetail } from "@/modules/vehicles/application/vehicle-queries";
import { VehicleDetailView } from "@/modules/vehicles/ui/vehicle-detail-view";

export default async function Page({
  params,
}: {
  params: Promise<{ placa: string }>;
}) {
  const { placa } = await params;
  const detail = await getVehicleDetail(decodeURIComponent(placa).toUpperCase());
  if (!detail) notFound();
  return <VehicleDetailView detail={detail} />;
}
