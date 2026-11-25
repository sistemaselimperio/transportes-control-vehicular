"use client";

import { Download, HandCoins } from "lucide-react";
import { useMemo, useState } from "react";
import { FlashMessage, useFlashMessage } from "@/components/app/flash-message";
import { PageHeader } from "@/components/app/page-header";
import { TabBar } from "@/components/app/tab-bar";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { ConfirmDeleteDialog } from "@/modules/petty-cash/ui/confirm-delete-dialog";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { deleteReceiptAction } from "../application/cotero-actions";
import { receiptFiltersToParams } from "../application/export-filters";
import { groupByCotero } from "../domain/cotero-identity";
import type { FleetCandidates } from "../domain/fleet-matching";
import { filterReceipts, NO_RECEIPT_FILTERS, totalsOfReceipts, type ReceiptFilters, type ReceiptRow } from "../domain/receipt-rules";
import type { CoteroProfileRow, SettlementRow, TariffRow } from "../domain/settlement-rows";
import { RECEIPT_STATUS_LABELS, type ReceiptStatus } from "../domain/settlement-rules";
import { formatCop } from "./format";
import { ReceiptEdit } from "./receipt-edit";
import { ReceiptImport } from "./receipt-import";
import { ReceiptList } from "./receipt-list";
import { SettlementCreate } from "./settlement-create";
import { SettlementList } from "./settlement-list";
import { SettlementPay } from "./settlement-pay";
import { TariffPanel } from "./tariff-panel";
import { useFleet } from "./use-fleet";

type Tab = "recibos" | "liquidaciones" | "tarifas";

const STATUS_OPTIONS: ReceiptStatus[] = ["pending", "settled", "paid"];

const FILTER_CONTROL = "h-11 md:h-9";

/**
 * Cotero payments page: the receipts with their filters and totals, the settlements per cotero and the
 * tariffs. Reading, editing, settling and paying all happen here.
 */
export function CoteroPaymentsView({
  receipts,
  settlements,
  tariffs,
  profiles,
  fleet,
  today,
}: {
  receipts: readonly ReceiptRow[];
  settlements: readonly SettlementRow[];
  tariffs: readonly TariffRow[];
  profiles: readonly CoteroProfileRow[];
  /** The active vehicles and drivers a receipt may name, read on the server. */
  fleet: FleetCandidates;
  /** Colombia's current day, read on the server. */
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("recibos");
  const [filters, setFilters] = useState<ReceiptFilters>(NO_RECEIPT_FILTERS);
  const [editing, setEditing] = useState<ReceiptRow | undefined>();
  const [deleting, setDeleting] = useState<ReceiptRow | undefined>();
  const [settleOpen, setSettleOpen] = useState(false);
  const [paying, setPaying] = useState<SettlementRow | undefined>();
  const [settlementCotero, setSettlementCotero] = useState<string | null>(null);
  const { message, flash } = useFlashMessage();
  const fleetControl = useFleet(fleet);

  const shown = useMemo(() => filterReceipts(receipts, filters), [receipts, filters]);
  const totals = useMemo(() => totalsOfReceipts(shown), [shown]);
  const coteros = useMemo(() => groupByCotero(receipts), [receipts]);
  const names = useMemo(() => [...new Set([...profiles.map((p) => p.name), ...receipts.map((r) => r.coteroName)])].sort((a, b) => a.localeCompare(b, "es")), [profiles, receipts]);
  const pendingCount = useMemo(() => receipts.filter((r) => r.status === "pending").length, [receipts]);
  const shownSettlements = useMemo(
    () => (filters.coteroKey ? settlements.filter((s) => s.coteroKey === filters.coteroKey) : settlements),
    [settlements, filters.coteroKey],
  );

  const set = <K extends keyof ReceiptFilters>(key: K, value: ReceiptFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_RECEIPT_FILTERS);
  const exportHref = `/api/pagos-coteros/exportar${filtered ? `?${receiptFiltersToParams(filters).toString()}` : ""}`;

  return (
    <section className="space-y-5">
      <PageHeader
        title="Pagos a coteros"
        description="Recibos de caja menor de los coteros, liquidaciones y pagos."
        actions={
          <>
            <ReceiptImport tariffs={tariffs} today={today} fleet={fleetControl} onDone={flash} />
            <Button
              variant="outline"
              className="h-11 px-4 md:h-10"
              onClick={() => {
                setSettlementCotero(filters.coteroKey);
                setSettleOpen(true);
              }}
              disabled={pendingCount === 0}
              title={pendingCount === 0 ? "No hay recibos pendientes" : "Liquida los recibos pendientes de un cotero"}
            >
              <HandCoins aria-hidden />
              Liquidar
            </Button>
          </>
        }
      />

      {/* Suggestions for the cotero name field of the receipt forms. */}
      <datalist id="cotero-names">
        {names.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <TabBar
        label="Secciones"
        idPrefix="cotero-tab"
        panelId="cotero-panel"
        active={tab}
        onSelect={setTab}
        items={[
          { key: "recibos", label: "Recibos", count: receipts.length },
          { key: "liquidaciones", label: "Liquidaciones", count: settlements.length },
          { key: "tarifas", label: "Tarifas", count: tariffs.length },
        ]}
      />

      <div role="tabpanel" id="cotero-panel" aria-labelledby={`cotero-tab-${tab}`} className="space-y-5">
        {tab !== "tarifas" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <Label htmlFor="cotero-from" className="mb-1 block text-xs text-muted-foreground">
                Desde
              </Label>
              <Input id="cotero-from" type="date" className={FILTER_CONTROL} value={filters.from ?? ""} max={filters.to ?? undefined} onChange={(e) => set("from", e.target.value || null)} />
            </div>
            <div>
              <Label htmlFor="cotero-to" className="mb-1 block text-xs text-muted-foreground">
                Hasta
              </Label>
              <Input id="cotero-to" type="date" className={FILTER_CONTROL} value={filters.to ?? ""} min={filters.from ?? undefined} onChange={(e) => set("to", e.target.value || null)} />
            </div>
            <div>
              <Label htmlFor="cotero-filter" className="mb-1 block text-xs text-muted-foreground">
                Cotero
              </Label>
              <NativeSelect id="cotero-filter" className={FILTER_CONTROL} value={filters.coteroKey ?? ""} onChange={(e) => set("coteroKey", e.target.value || null)}>
                <option value="">Todos</option>
                {coteros.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {tab === "recibos" && (
              <>
                <div>
                  <Label htmlFor="cotero-status" className="mb-1 block text-xs text-muted-foreground">
                    Estado
                  </Label>
                  <NativeSelect
                    id="cotero-status"
                    className={FILTER_CONTROL}
                    value={filters.status ?? ""}
                    onChange={(e) => set("status", STATUS_OPTIONS.find((s) => s === e.target.value) ?? null)}
                  >
                    <option value="">Todos</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {RECEIPT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <Label htmlFor="cotero-plate" className="mb-1 block text-xs text-muted-foreground">
                    Placa
                  </Label>
                  <Input id="cotero-plate" className={FILTER_CONTROL} autoComplete="off" value={filters.plate} onChange={(e) => set("plate", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="cotero-destination" className="mb-1 block text-xs text-muted-foreground">
                    Destino
                  </Label>
                  <Input id="cotero-destination" className={FILTER_CONTROL} autoComplete="off" value={filters.destination} onChange={(e) => set("destination", e.target.value)} />
                </div>
              </>
            )}
          </div>
        )}

        {tab === "recibos" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="num text-sm text-muted-foreground" aria-live="polite">
                {totals.count} de {receipts.length} recibos · {formatDecimal(totals.tons, 3)} t · {formatCop(totals.amount)}
              </p>
              <a href={exportHref} className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4 md:h-9")}>
                <Download aria-hidden />
                Exportar Excel
              </a>
            </div>
            <ReceiptList rows={shown} onEdit={setEditing} onDelete={setDeleting} />
          </>
        )}

        {tab === "liquidaciones" && (
          <SettlementList
            rows={shownSettlements.filter((s) => (!filters.from || s.date >= filters.from) && (!filters.to || s.date <= filters.to))}
            receipts={receipts}
            onPay={setPaying}
            onDone={flash}
          />
        )}

        {tab === "tarifas" && <TariffPanel tariffs={tariffs} today={today} onDone={flash} />}
      </div>

      <FlashMessage message={message} />

      <ReceiptEdit row={editing} fleet={fleetControl} onClose={() => setEditing(undefined)} onDone={flash} />

      <ConfirmDeleteDialog
        open={deleting !== undefined}
        title="Eliminar recibo"
        description={deleting && `${deleting.receiptNumber} · ${deleting.coteroName}`}
        warning={deleting ? `Se eliminará el recibo ${deleting.receiptNumber}${deleting.filePath ? " y su archivo, si ningún otro recibo lo usa" : ""}.` : ""}
        action={() => (deleting ? deleteReceiptAction(deleting.id) : Promise.resolve({ ok: false as const, error: "Sin recibo." }))}
        onClose={() => setDeleting(undefined)}
        onDone={flash}
      />

      <SettlementCreate
        open={settleOpen}
        onOpenChange={setSettleOpen}
        receipts={receipts}
        profiles={profiles}
        presetKey={settlementCotero}
        onDone={(created) => {
          flash(created);
          setTab("liquidaciones");
        }}
      />

      <SettlementPay settlement={paying} today={today} onClose={() => setPaying(undefined)} onDone={flash} />
    </section>
  );
}
