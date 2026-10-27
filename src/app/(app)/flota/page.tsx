import { PageHeader } from "@/components/app/page-header";
import { currentDay } from "@/lib/current-day";
import { getVehicleFormOptions, listVehicleRows } from "@/modules/vehicles/application/vehicle-queries";
import { parseFilterParams } from "@/modules/vehicles/domain/vehicle-filters";
import { NewVehicleButton } from "@/modules/vehicles/ui/vehicle-form";
import { VehicleGrid } from "@/modules/vehicles/ui/vehicle-grid";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [today, params] = await Promise.all([currentDay(), searchParams]);
  const [rows, options] = await Promise.all([listVehicleRows(today), getVehicleFormOptions(today)]);
  const { group } = parseFilterParams(params);
  return (
    <section className="space-y-5 md:flex md:h-[calc(100dvh-4rem)] md:flex-col md:gap-5 md:space-y-0">
      <PageHeader
        title="Flota"
        description="Todos los vehículos, su documentación y su mantenimiento."
        actions={<NewVehicleButton options={options} />}
      />
      <VehicleGrid rows={rows} group={group} />
    </section>
  );
}
