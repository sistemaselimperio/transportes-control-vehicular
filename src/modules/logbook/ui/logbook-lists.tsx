"use client";

import { Popover } from "@base-ui/react/popover";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import { formatKm } from "@/modules/vehicles/domain/vehicle-row";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { deleteOilChangeAction } from "@/modules/vehicles/application/vehicle-actions";
import { deleteLogbookEntryAction } from "../application/logbook-actions";
import { SERVICE_KIND_LABELS, type FuelRow, type OilRow, type ServiceRow, type TireRow } from "../domain/logbook";

const PLATE_LINK = "plate outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/70";

const gallonsText = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
const priceText = (n: number | null) => (n === null ? "—" : formatPrice(n));

/** What a record says in one line plus an optional detail line (cards and the vehicle file). */
interface Summary {
  title: string;
  detail: string | null;
  amount: string | null;
}

const joinDetail = (parts: Array<string | null | undefined>) => parts.filter(Boolean).join(" · ") || null;

/** How one kind of record is shown and deleted. */
interface Spec<T extends { id: number; plate: string; date: string; driverName: string | null }> {
  /** Singular noun for accessible labels ("servicio de ABC-123"). */
  noun: string;
  columns: ReadonlyArray<{ header: string; cell: (row: T) => ReactNode; right?: boolean; muted?: boolean }>;
  summary: (row: T) => Summary;
  remove: (id: number) => Promise<ActionResult>;
}

export const SERVICE_SPEC: Spec<ServiceRow> = {
  noun: "mantenimiento",
  columns: [
    { header: "Fecha", cell: (r) => formatDisplayDate(r.date) },
    { header: "Placa", cell: (r) => <PlateLink plate={r.plate} /> },
    { header: "Tipo", cell: (r) => SERVICE_KIND_LABELS[r.kind] },
    { header: "Descripción", cell: (r) => <span className="block min-w-64 font-medium break-words whitespace-pre-line">{r.description}</span> },
    { header: "Proveedor", cell: (r) => r.provider ?? "—" },
    { header: "Conductor", cell: (r) => r.driverName ?? "—" },
    { header: "Precio", cell: (r) => priceText(r.price), right: true },
    { header: "Novedad", cell: (r) => <Clamp text={r.notes} />, muted: true },
  ],
  summary: (r) => ({
    title: r.description,
    detail: joinDetail([SERVICE_KIND_LABELS[r.kind], r.provider, r.notes]),
    amount: r.price === null ? null : formatPrice(r.price),
  }),
  remove: (id) => deleteLogbookEntryAction("service", id),
};

export const OIL_SPEC: Spec<OilRow> = {
  noun: "cambio de aceite",
  columns: [
    { header: "Fecha", cell: (r) => formatDisplayDate(r.date) },
    { header: "Placa", cell: (r) => <PlateLink plate={r.plate} /> },
    { header: "Km", cell: (r) => (r.km != null ? formatKm(r.km) : "—") },
    {
      header: "Próximo cambio",
      cell: (r) => joinDetail([r.nextDate && formatDisplayDate(r.nextDate), r.nextKm != null ? `${formatKm(r.nextKm)} km` : null]) ?? "—",
    },
    { header: "Conductor", cell: (r) => r.driverName ?? "—" },
    { header: "Notas", cell: (r) => <Clamp text={r.notes} />, muted: true },
  ],
  summary: (r) => ({
    title: r.km != null ? `${formatKm(r.km)} km` : "Sin kilometraje",
    detail: joinDetail([
      r.nextKm != null ? `próximo a ${formatKm(r.nextKm)} km` : null,
      r.nextDate ? `próximo el ${formatDisplayDate(r.nextDate)}` : null,
      r.notes,
    ]),
    amount: null,
  }),
  remove: deleteOilChangeAction,
};

export const TIRE_SPEC: Spec<TireRow> = {
  noun: "cambio de llantas",
  columns: [
    { header: "Fecha", cell: (r) => formatDisplayDate(r.date) },
    { header: "Placa", cell: (r) => <PlateLink plate={r.plate} /> },
    { header: "Cant.", cell: (r) => r.quantity },
    { header: "Detalle", cell: (r) => <span className="font-medium">{r.reference}</span> },
    { header: "Conductor", cell: (r) => r.driverName ?? "—" },
    { header: "Precio", cell: (r) => priceText(r.price), right: true },
    { header: "Observación", cell: (r) => <Clamp text={r.notes} />, muted: true },
  ],
  summary: (r) => ({
    title: `${r.quantity} × ${r.reference}`,
    detail: r.notes,
    amount: r.price === null ? null : formatPrice(r.price),
  }),
  remove: (id) => deleteLogbookEntryAction("tire", id),
};

export const FUEL_SPEC: Spec<FuelRow> = {
  noun: "tanqueo",
  columns: [
    { header: "Fecha", cell: (r) => formatDisplayDate(r.date) },
    { header: "Placa", cell: (r) => <PlateLink plate={r.plate} /> },
    { header: "Cantidad", cell: (r) => gallonsText(r.gallons), right: true },
    { header: "Valor", cell: (r) => formatPrice(r.amount), right: true },
    { header: "Estación", cell: (r) => r.provider ?? "—" },
    { header: "Conductor", cell: (r) => r.driverName ?? "—" },
  ],
  summary: (r) => ({ title: `Cantidad ${gallonsText(r.gallons)}`, detail: r.provider, amount: formatPrice(r.amount) }),
  remove: (id) => deleteLogbookEntryAction("fuel", id),
};

function PlateLink({ plate }: { plate: string }) {
  return (
    <Link href={`/flota/${encodeURIComponent(plate)}`} className={PLATE_LINK}>
      {plate}
    </Link>
  );
}

function Clamp({ text }: { text: string | null }) {
  return (
    <span className="block max-w-56 truncate" title={text ?? undefined}>
      {text ?? "—"}
    </span>
  );
}

/**
 * Edit and delete buttons of one record. Deleting asks first in a small popover anchored to the
 * trash button, so the row never changes size, and reports the outcome through `onResult`.
 */
export function RowActions({
  noun,
  plate,
  date,
  onEdit,
  remove,
  onResult,
}: {
  noun: string;
  plate: string;
  date: string;
  onEdit: () => void;
  remove: () => Promise<ActionResult>;
  onResult: (result: ActionResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center whitespace-nowrap">
      <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={`Editar ${noun} de ${plate}`} title="Editar" onClick={onEdit}>
        <Pencil aria-hidden />
      </Button>
      {/* It stays open while the delete runs, so the spinner is seen and a second click cannot repeat it. */}
      <Popover.Root open={open} onOpenChange={(next) => (!next && pending ? undefined : setOpen(next))}>
        <Popover.Trigger
          render={<Button variant="ghost" size="icon" className="size-11 hover:text-destructive md:size-9" />}
          aria-label={`Eliminar ${noun} de ${plate}`}
          title="Eliminar"
        >
          <Trash2 aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
            <Popover.Popup className="w-[min(20rem,calc(100vw-2rem))] space-y-3 rounded-xl border bg-popover p-4 shadow-soft outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
              <div className="space-y-1 whitespace-normal">
                <Popover.Title className="text-sm font-semibold">¿Eliminar este registro?</Popover.Title>
                <Popover.Description className="num text-sm break-words">
                  {noun} · {plate} · {formatDisplayDate(date)}
                </Popover.Description>
                <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-11 px-3 md:h-8" disabled={pending} onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 px-3 md:h-8"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await remove();
                      setOpen(false);
                      onResult(result);
                    })
                  }
                >
                  {pending && <Loader2 className="animate-spin" aria-hidden />}
                  Eliminar
                </Button>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

interface ListProps<T> {
  rows: readonly T[];
  /** Text shown when nothing matches the current filters. */
  empty: string;
  onEdit: (row: T) => void;
  onResult: (result: ActionResult) => void;
}

type Row = { id: number; plate: string; date: string; driverName: string | null };

type Column<T extends Row> = Spec<T>["columns"][number];

const cellClass = <T extends Row>(c: Column<T>) =>
  `px-4 py-3 ${c.right ? "num text-right whitespace-nowrap" : ""} ${c.muted ? "text-muted-foreground" : ""} ${c.header === "Fecha" ? "num whitespace-nowrap" : ""}`;

const headerClass = <T extends Row>(c: Column<T>) => `micro-label px-4 py-3 font-medium ${c.right ? "text-right" : ""}`;

/** A fleet-wide list: a table from `md`, cards on phones. */
function LogList<T extends Row>({ spec, rows, empty, onEdit, onResult }: ListProps<T> & { spec: Spec<T> }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const actions = (r: T) => (
    <RowActions noun={spec.noun} plate={r.plate} date={r.date} onEdit={() => onEdit(r)} remove={() => spec.remove(r.id)} onResult={onResult} />
  );
  return (
    <>
      <ul className="grid gap-3 md:hidden">
        {rows.map((r) => {
          const s = spec.summary(r);
          return (
            <li key={r.id} className="space-y-2 rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <PlateLink plate={r.plate} />
                  <span className="num text-sm text-muted-foreground">{formatDisplayDate(r.date)}</span>
                </div>
                <div className="-mt-2 -mr-2 shrink-0">{actions(r)}</div>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 font-medium break-words whitespace-pre-line">{s.title}</span>
                {s.amount && <span className="num shrink-0 font-semibold">{s.amount}</span>}
              </div>
              {s.detail && <p className="text-sm text-muted-foreground">{s.detail}</p>}
              {r.driverName && <p className="text-sm text-muted-foreground">Conductor: {r.driverName}</p>}
            </li>
          );
        })}
      </ul>

      <div className="panel hidden md:block">
        <div className="plate-head">
          <span className="micro-label">
            {rows.length} {rows.length === 1 ? "registro" : "registros"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b">
                {spec.columns.map((c) => (
                  <th key={c.header} scope="col" className={headerClass(c)}>
                    {c.header}
                  </th>
                ))}
                <th scope="col" className="w-px">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  {spec.columns.map((c) => (
                    <td key={c.header} className={cellClass(c)}>
                      {c.cell(r)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right">{actions(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export const ServiceList = (p: ListProps<ServiceRow>) => <LogList spec={SERVICE_SPEC} {...p} />;
export const OilList = (p: ListProps<OilRow>) => <LogList spec={OIL_SPEC} {...p} />;
export const TireList = (p: ListProps<TireRow>) => <LogList spec={TIRE_SPEC} {...p} />;
export const FuelList = (p: ListProps<FuelRow>) => <LogList spec={FUEL_SPEC} {...p} />;

interface CompactProps<T> {
  rows: readonly T[];
  empty?: string;
}

/**
 * One vehicle's records of a kind, read-only: from `md` a table with the Bitácora columns (minus
 * the plate) that scrolls under a sticky header, so long histories stay readable; ruled lines on
 * phones. Records are created, edited and deleted in the Bitácora page.
 */
function CompactLog<T extends Row>({ spec, rows, empty = "Sin registros." }: CompactProps<T> & { spec: Spec<T> }) {
  if (rows.length === 0) return <p className="border-b py-2.5 text-sm text-muted-foreground">{empty}</p>;
  const columns = spec.columns.filter((c) => c.header !== "Placa");
  return (
    <>
      <div className="hidden max-h-[32rem] overflow-auto border-b md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-background text-left">
            <tr className="border-b">
              {columns.map((c) => (
                <th key={c.header} scope="col" className={headerClass(c)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/50">
                {columns.map((c) => (
                  <td key={c.header} className={cellClass(c)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CompactLines spec={spec} rows={rows} />
    </>
  );
}

/** Phone layout of `CompactLog`: date and what was done on the left, the amount on the right. */
function CompactLines<T extends Row>({ spec, rows }: { spec: Spec<T>; rows: readonly T[] }) {
  return (
    <ul className="md:hidden">
      {rows.map((r) => {
        const s = spec.summary(r);
        return (
          <li key={r.id} className="flex items-start justify-between gap-2 border-b py-2 text-sm">
            <div className="min-w-0">
              <p className="flex flex-wrap gap-x-3">
                <span className="num font-medium">{formatDisplayDate(r.date)}</span>
                <span className="font-medium">{s.title}</span>
              </p>
              {s.detail && <p className="text-muted-foreground">{s.detail}</p>}
              {r.driverName && <p className="text-muted-foreground">Conductor: {r.driverName}</p>}
            </div>
            {s.amount && <span className="num shrink-0 font-medium">{s.amount}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export const CompactServices = (p: CompactProps<ServiceRow>) => <CompactLog spec={SERVICE_SPEC} {...p} />;
export const CompactOilChanges = (p: CompactProps<OilRow>) => <CompactLog spec={OIL_SPEC} {...p} />;
export const CompactTires = (p: CompactProps<TireRow>) => <CompactLog spec={TIRE_SPEC} {...p} />;
export const CompactFuel = (p: CompactProps<FuelRow>) => <CompactLog spec={FUEL_SPEC} {...p} />;
