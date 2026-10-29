import { DeleteAllButton } from "@/components/app/delete-all-button";
import { PageHeader } from "@/components/app/page-header";
import { currentDay } from "@/lib/current-day";
import { canWrite } from "@/lib/permissions";
import { requireSectionAccess } from "@/lib/session";
import { deleteAllVehiclesAction } from "@/modules/vehicles/application/vehicle-actions";
import { getVehicleFormOptions, listVehicleRows } from "@/modules/vehicles/application/vehicle-queries";
import { parseFilterParams } from "@/modules/vehicles/domain/vehicle-filters";
import { NewVehicleButton } from "@/modules/vehicles/ui/vehicle-form";
import { VehicleGrid } from "@/modules/vehicles/ui/vehicle-grid";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const role = await requireSectionAccess("fleet");
  const editable = canWrite(role);
  const [today, params] = await Promise.all([currentDay(), searchParams]);
  const [rows, options] = await Promise.all([
    listVehicleRows(today),
    editable ? getVehicleFormOptions(today) : null,
  ]);
  const { group } = parseFilterParams(params);
  return (
    <section className="space-y-5 md:flex md:h-[calc(100dvh-4rem)] md:flex-col md:gap-5 md:space-y-0">
      <PageHeader
        title="Flota"
        description="Todos los vehículos, su documentación y su mantenimiento."
        actions={
          editable && options && (
            <>
              <DeleteAllButton count={rows.length} title="Eliminar todos los vehículos" action={deleteAllVehiclesAction}>
                <p className="font-medium">Se eliminarán TODOS los vehículos de la flota, no solo los que ves en pantalla.</p>
                <p className="text-muted-foreground">
                  También se borra todo su historial: documentos, mantenimiento, combustible, ventas, archivos y
                  los vínculos con propietarios y conductores.
                </p>
              </DeleteAllButton>
              <NewVehicleButton options={options} />
            </>
          )
        }
      />
      <VehicleGrid rows={rows} group={group} />
    </section>
  );
}
