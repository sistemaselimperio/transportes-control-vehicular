import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, ClipboardCheck, Search } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { InspectionFilters } from "../domain/inspection-filters";
import type { InspectionListRow } from "../infrastructure/inspection-repository";
import { formatInspectionDate } from "./inspection-format";

function pageHref(filters: InspectionFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.plate) params.set("placa", filters.plate);
  if (filters.from) params.set("desde", filters.from);
  if (filters.to) params.set("hasta", filters.to);
  if (page > 1) params.set("pagina", String(page));
  const qs = params.toString();
  return qs ? `/preoperacionales?${qs}` : "/preoperacionales";
}

/** Own badge instead of `StatusPill`, whose hidden text says "Vencido" / "Vigente". Icon + text, not colour alone. */
function StatusBadge({ critical }: { critical: boolean }) {
  const Icon = critical ? CircleAlert : CircleCheck;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[5px] px-2 py-1 text-xs leading-none font-medium whitespace-nowrap ring-1 ring-inset",
        critical
          ? "bg-danger-foreground/15 text-danger-foreground ring-danger-foreground/40"
          : "bg-ok text-ok-foreground ring-ok-foreground/25",
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {critical ? "Crítico" : "OK"}
    </span>
  );
}

/** Read-only list of submitted inspections: a GET filter form, the rows and simple prev / next paging. */
export function InspectionsView({
  rows,
  filters,
  hasNext,
}: {
  rows: readonly InspectionListRow[];
  filters: InspectionFilters;
  hasNext: boolean;
}) {
  const filtered = Boolean(filters.plate || filters.from || filters.to);
  return (
    <section className="space-y-5">
      <PageHeader
        title="Preoperacionales"
        description="Inspecciones diarias que envían los conductores desde el formulario FO-PESV-016."
      />

      <form method="get" action="/preoperacionales" className="flex flex-wrap items-end gap-3">
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
              <li key={r.id}>
                <Link
                  href={`/preoperacionales/${r.id}`}
                  className="block space-y-2 rounded-2xl border bg-card p-4 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="plate">{r.plate}</span>
                    <StatusBadge critical={r.hasCriticalFailure} />
                  </div>
                  <p className="font-medium">{r.driverName}</p>
                  <p className="text-sm text-muted-foreground">{r.route}</p>
                  <p className="num text-xs text-muted-foreground">
                    {formatInspectionDate(r.inspectionDate)} · {r.inspectionTime}
                  </p>
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
                    {["Fecha y hora", "Placa", "Conductor", "Ruta", "Estado"].map((h) => (
                      <th key={h} scope="col" className="micro-label px-4 py-3 font-medium">
                        {h}
                      </th>
                    ))}
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
                        <span className="plate">{r.plate}</span>
                      </td>
                      <td className="px-4 py-3 font-medium">{r.driverName}</td>
                      <td className="px-4 py-3">{r.route}</td>
                      <td className="px-4 py-3">
                        <StatusBadge critical={r.hasCriticalFailure} />
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
