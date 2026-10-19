import { listVehicleRows } from "@/modules/vehicles/application/vehicle-queries";
import { parseFilterParams } from "@/modules/vehicles/domain/vehicle-filters";
import { VehicleGrid } from "@/modules/vehicles/ui/vehicle-grid";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [rows, params] = await Promise.all([listVehicleRows(), searchParams]);
  const filters = parseFilterParams(params);
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">Vehículos</h1>
      {/* key: re-seed the grid state when the URL filters change */}
      <VehicleGrid key={JSON.stringify(filters)} rows={rows} initialFilters={filters} />
    </section>
  );
}
