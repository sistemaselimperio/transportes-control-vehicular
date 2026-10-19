import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import type { HistoryItem, VehicleDetail } from "../application/vehicle-queries";
import { formatKm } from "../domain/vehicle-row";
import { VehicleActionsBar } from "./vehicle-actions-bar";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children}</dd>
    </div>
  );
}

function History({ title, items }: { title: string; items: HistoryItem[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin registros.</p>
        ) : (
          <ul className="divide-y text-sm">
            {items.map((item, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-x-3 py-1.5">
                <span className="font-medium">{item.title}</span>
                <span className="text-muted-foreground">{item.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Vehicle detail: facts, due dates, actions and history timelines. */
export function VehicleDetailView({ detail }: { detail: VehicleDetail }) {
  const r = detail.row;
  return (
    <div className="space-y-4">
      <Link
        href="/vehiculos"
        className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Vehículos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{r.plate}</h1>
          <p className="text-sm text-muted-foreground">
            {[r.className, r.brandLine].filter(Boolean).join(" · ")}
          </p>
        </div>
        <StatusPill status={r.overall} className="text-sm">
          {r.statusLabel}
        </StatusPill>
      </header>

      <VehicleActionsBar plate={r.plate} status={r.vehicleStatus} ctx={detail.actions} />

      <Card size="sm">
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
            <Fact label="Propietario">{r.ownerName ?? "Sin propietario"}</Fact>
            <Fact label="Conductor">
              {r.driverName ?? "—"}
              {r.driverPhone && (
                <>
                  {" · "}
                  <a href={`tel:${r.driverPhone}`} className="underline">
                    {r.driverPhone}
                  </a>
                </>
              )}
            </Fact>
            <Fact label="Municipio">{r.municipality ?? "—"}</Fact>
            <Fact label="Servicio">{r.serviceLabel}</Fact>
            <Fact label="Kilometraje">
              {r.km != null ? formatKm(r.km) : r.odometerWorking ? "—" : "Odómetro dañado"}
            </Fact>
            <Fact label="Último cambio de aceite">
              {r.lastOilDate ? formatDisplayDate(r.lastOilDate) : "—"}
            </Fact>
          </dl>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Vencimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-5">
            <Fact label="SOAT">
              <StatusPill status={r.soat.status}>{r.soat.text || "—"}</StatusPill>
            </Fact>
            <Fact label="Tecnomecánica">
              <StatusPill status={r.tecno.status}>{r.tecno.text || "—"}</StatusPill>
            </Fact>
            <Fact label="Póliza">
              <StatusPill status={r.policy.status}>{r.policy.text || "—"}</StatusPill>
            </Fact>
            <Fact label="Impuesto">
              <StatusPill status={r.tax.status}>{r.tax.text || "—"}</StatusPill>
            </Fact>
            <Fact label="Próximo cambio de aceite">
              <StatusPill status={r.nextChange.status}>{r.nextChange.text || "—"}</StatusPill>
            </Fact>
          </dl>
        </CardContent>
      </Card>

      {r.notes && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{r.notes}</p>
          </CardContent>
        </Card>
      )}

      {detail.sale && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Venta</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <span className="font-medium">{detail.sale.title}</span>
            <span className="text-muted-foreground"> · {detail.sale.detail}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <History title="Propietarios" items={detail.ownerships} />
        <History title="Conductores" items={detail.drivers} />
        <History title="Documentos" items={detail.documents} />
        <History title="Cambios de aceite" items={detail.oilChanges} />
      </div>
    </div>
  );
}
