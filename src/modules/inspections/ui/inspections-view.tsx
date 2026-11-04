import { ChevronLeft, ChevronRight, ClipboardCheck, FileText, Search } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { exitStatus } from "../domain/exit-decision";
import { EXIT_FILTER_OPTIONS, exitFilterParam, type InspectionFilters } from "../domain/inspection-filters";
import type { InspectionListRow } from "../infrastructure/inspection-repository";
import { DeleteInspectionButton } from "./delete-inspection-button";
import { ExitBadge, NotRegisteredBadge, StatusBadge, UncheckedBadge } from "./inspection-badges";
import { formatInspectionDate } from "./inspection-format";

const rowSummary = (r: InspectionListRow) => `${r.plate} · ${formatInspectionDate(r.inspectionDate)} ${r.inspectionTime}`;

function pageHref(filters: InspectionFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.plate) params.set("placa", filters.plate);
  if (filters.from) params.set("desde", filters.from);
  if (filters.to) params.set("hasta", filters.to);
  if (filters.driverId) params.set("conductor", String(filters.driverId));
  if (filters.vehicleId) params.set("vehiculo", String(filters.vehicleId));
  const exit = exitFilterParam(filters.exit);
  if (exit) params.set("salida", exit);
  if (page > 1) params.set("pagina", String(page));
  const qs = params.toString();
  return qs ? `/preoperacionales?${qs}` : "/preoperacionales";
}

/** The plate as a link to the vehicle's file when it is registered, else plain text plus a badge. */
function PlateCell({ row, linked }: { row: InspectionListRow; linked: boolean }) {
  if (row.vehiclePlate && linked) {
    return (
      <Link
        href={`/flota/${encodeURIComponent(row.vehiclePlate)}`}
        className="plate outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/70"
      >
        {row.plate}
      </Link>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="plate">{row.plate}</span>
      {!row.vehiclePlate && <NotRegisteredBadge>Placa no registrada</NotRegisteredBadge>}
    </span>
  );
}

/**
 * List of submitted inspections: a GET filter form, the rows and simple prev / next paging. Only the
 * role that manages inspections (`canDelete`) gets a delete action per row.
 */
export function InspectionsView({
  rows,
  filters,
  hasNext,
  canDelete,
}: {
  rows: readonly InspectionListRow[];
  filters: InspectionFilters;
  hasNext: boolean;
  canDelete: boolean;
}) {
  const filtered = Boolean(filters.plate || filters.from || filters.to || filters.driverId || filters.vehicleId || filters.exit !== "ALL");
  return (
    <section className="space-y-5">
      <PageHeader
        title="Preoperacionales"
        description="Inspecciones diarias que envían los conductores desde el formulario FO-PESV-016."
      />

      <form method="get" action="/preoperacionales" className="flex flex-wrap items-end gap-3">
        {/* The registered driver / vehicle filters come from links elsewhere; keep them when filtering. */}
        {filters.driverId && <input type="hidden" name="conductor" value={filters.driverId} />}
        {filters.vehicleId && <input type="hidden" name="vehiculo" value={filters.vehicleId} />}
        <div className="space-y-1.5">
          <Label htmlFor="insp-plate" className="text-sm text-foreground">
            Placa
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="insp-plate"
              name="placa"
              defaultValue={filters.plate}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="ABC123"
              className="h-11 w-40 pl-9 uppercase md:h-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="insp-from" className="text-sm text-foreground">
            Desde
          </Label>
          <Input id="insp-from" name="desde" type="date" defaultValue={filters.from ?? ""} className="h-11 md:h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="insp-to" className="text-sm text-foreground">
            Hasta
          </Label>
          <Input id="insp-to" name="hasta" type="date" defaultValue={filters.to ?? ""} className="h-11 md:h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="insp-exit" className="text-sm text-foreground">
            Salida
          </Label>
          <NativeSelect id="insp-exit" name="salida" defaultValue={exitFilterParam(filters.exit) ?? ""} className="h-11 w-40 md:h-9">
            {EXIT_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={exitFilterParam(o.value) ?? ""}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" className="h-11 px-4 md:h-9">
          Filtrar
        </Button>
        {filtered && (
          <Link href="/preoperacionales" className={buttonVariants({ variant: "ghost", className: "h-11 px-4 md:h-9" })}>
            Limpiar
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardCheck className="size-4" aria-hidden />
          {filtered ? "Ninguna inspección coincide con el filtro." : "Todavía no se ha enviado ninguna inspección."}
        </p>
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="relative">
                {/* Outside the card link: a button cannot sit inside a link. */}
                {canDelete && (
                  <div className="absolute right-2 bottom-2 z-10">
                    <DeleteInspectionButton inspectionId={r.id} summary={rowSummary(r)} iconOnly />
                  </div>
                )}
                <Link
                  href={`/preoperacionales/${r.id}`}
                  className="block space-y-2 rounded-2xl border bg-card p-4 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <PlateCell row={r} linked={false} />
                    <span className="flex flex-wrap items-center justify-end gap-1">
                      <StatusBadge critical={r.hasCriticalFailure} />
                      <UncheckedBadge count={r.uncheckedCount} />
                      <ExitBadge status={exitStatus(r)} />
                    </span>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                    {r.driverName}
                    {!r.driverId && <NotRegisteredBadge>Conductor no registrado</NotRegisteredBadge>}
                  </p>
                  <p className="text-sm text-muted-foreground">{r.route}</p>
                  <p className="num text-xs text-muted-foreground">
                    {formatInspectionDate(r.inspectionDate)} · {r.inspectionTime}
                  </p>
                  <span className="flex items-center gap-1.5 pt-1 text-sm font-medium text-foreground">
                    <FileText className="size-4" aria-hidden />
                    Ver formato
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="panel hidden md:block">
            <div className="plate-head">
              <span className="micro-label">
                {rows.length} {rows.length === 1 ? "inspección" : "inspecciones"} en esta página
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="border-b">
                    {["Fecha y hora", "Placa", "Conductor", "Ruta", "Estado", "Salida"].map((h) => (
                      <th key={h} scope="col" className="micro-label px-4 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/50">
                      <td className="num px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/preoperacionales/${r.id}`}
                          className="underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/70"
                        >
                          {formatInspectionDate(r.inspectionDate)} {r.inspectionTime}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <PlateCell row={r} linked />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {r.driverName}
                          {!r.driverId && <NotRegisteredBadge>Conductor no registrado</NotRegisteredBadge>}
                        </span>
                      </td>
                      <td className="px-4 py-3">{r.route}</td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap items-center gap-1">
                          <StatusBadge critical={r.hasCriticalFailure} />
                          <UncheckedBadge count={r.uncheckedCount} />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ExitBadge status={exitStatus(r)} />
                      </td>
                      <td className="px-2 py-1">
                        <span className="flex items-center justify-end gap-1">
                          <Link
                            href={`/preoperacionales/${r.id}`}
                            aria-label={`Ver formato ${rowSummary(r)}`}
                            className={buttonVariants({ variant: "ghost", size: "sm", className: "h-9 gap-1.5 px-2.5 whitespace-nowrap" })}
                          >
                            <FileText aria-hidden />
                            Ver formato
                          </Link>
                          {canDelete && <DeleteInspectionButton inspectionId={r.id} summary={rowSummary(r)} iconOnly />}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {(filters.page > 1 || hasNext) && (
        <nav aria-label="Paginación" className="flex items-center justify-between gap-3">
          {filters.page > 1 ? (
            <Link
              href={pageHref(filters, filters.page - 1)}
              className={buttonVariants({ variant: "outline", className: "h-11 px-4 md:h-9" })}
            >
              <ChevronLeft aria-hidden />
              Más recientes
            </Link>
          ) : (
            <span />
          )}
          <span className="num text-sm text-muted-foreground">Página {filters.page}</span>
          {hasNext ? (
            <Link
              href={pageHref(filters, filters.page + 1)}
              className={buttonVariants({ variant: "outline", className: "h-11 px-4 md:h-9" })}
            >
              Más antiguas
              <ChevronRight aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
