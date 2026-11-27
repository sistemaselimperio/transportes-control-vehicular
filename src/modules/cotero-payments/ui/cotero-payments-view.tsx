"use client";

import { Download, HandCoins, Printer, X } from "lucide-react";
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
import { summarizeCoteros } from "../domain/cotero-summary";
import type { FleetCandidates } from "../domain/fleet-matching";
import { filterSettlements } from "../domain/settlement-filter";
import { filterReceipts, NO_RECEIPT_FILTERS, totalsOfReceipts, type ReceiptFilters, type ReceiptRow } from "../domain/receipt-rules";
import type { CoteroProfileRow, SettlementRow, TariffRow } from "../domain/settlement-rows";
import { RECEIPT_STATUS_LABELS, type ReceiptStatus } from "../domain/settlement-rules";
import { CoteroList } from "./cotero-list";
import { CoteroPanel } from "./cotero-panel";
import { formatCop } from "./format";
import { ReceiptEdit } from "./receipt-edit";
import { ReceiptImport } from "./receipt-import";
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
  /** The cotero whose receipts are open in the side panel. */
  const [openCotero, setOpenCotero] = useState<string | null>(null);
  const [editing, setEditing] = useState<ReceiptRow | undefined>();
  const [deleting, setDeleting] = useState<ReceiptRow | undefined>();
  const [settleOpen, setSettleOpen] = useState(false);
  const [paying, setPaying] = useState<SettlementRow | undefined>();
  const [settlementCotero, setSettlementCotero] = useState<string | null>(null);
  const [settlementIds, setSettlementIds] = useState<readonly number[] | null>(null);
  /** The settlement just created, whose voucher is offered for printing. */
  const [voucherOffer, setVoucherOffer] = useState<{ id: number; message: string } | null>(null);
  const { message, flash } = useFlashMessage();
  const fleetControl = useFleet(fleet);

  const shown = useMemo(() => filterReceipts(receipts, filters), [receipts, filters]);
  const totals = useMemo(() => totalsOfReceipts(shown), [shown]);
  const coteros = useMemo(() => summarizeCoteros(shown), [shown]);
  const openSummary = useMemo(() => coteros.find((c) => c.key === openCotero), [coteros, openCotero]);
  const names = useMemo(() => [...new Set([...profiles.map((p) => p.name), ...receipts.map((r) => r.coteroName)])].sort((a, b) => a.localeCompare(b, "es")), [profiles, receipts]);
  const pendingCount = useMemo(() => receipts.filter((r) => r.status === "pending").length, [receipts]);
  const shownSettlements = useMemo(() => filterSettlements(settlements, filters), [settlements, filters]);
  const chipName = useMemo(() => {
    if (!filters.coteroKey) return null;
    return (
      profiles.find((p) => p.key === filters.coteroKey)?.name ??
      settlements.find((s) => s.coteroKey === filters.coteroKey)?.coteroName ??
      receipts.find((r) => r.coteroKey === filters.coteroKey)?.coteroName ??
      "Cotero"
    );
  }, [filters.coteroKey, profiles, settlements, receipts]);

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
            <ReceiptImport
              tariffs={tariffs}
              profiles={profiles}
              today={today}
              fleet={fleetControl}
              onDone={flash}
              onSettle={(coteroKey, ids) => {
                setSettlementCotero(coteroKey);
                setSettlementIds(ids);
                setSettleOpen(true);
              }}
            />
            <Button
              variant="outline"
              className="h-11 px-4 md:h-10"
              onClick={() => {
                setSettlementCotero(filters.coteroKey);
                setSettlementIds(null);
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

      {voucherOffer && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
          <p className="text-sm font-medium">{voucherOffer.message} Imprime el comprobante para contabilidad.</p>
          <div className="flex items-center gap-2">
            <a
              href={`/pagos-coteros/liquidaciones/${voucherOffer.id}/imprimir`}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants(), "h-11 px-4 md:h-10")}
            >
              <Printer aria-hidden />
              Imprimir comprobante
            </a>
            <Button variant="ghost" className="h-11 px-3 md:h-10" onClick={() => setVoucherOffer(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      )}

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
              <Label htmlFor="cotero-search" className="mb-1 block text-xs text-muted-foreground">
                Cotero
              </Label>
              <Input
                id="cotero-search"
                type="search"
                className={FILTER_CONTROL}
                placeholder="Nombre o cédula"
                autoComplete="off"
                value={filters.search}
                onChange={(e) => set("search", e.target.value)}
              />
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

        {tab !== "tarifas" && chipName !== null && (
          <div>
            <button
              type="button"
              onClick={() => set("coteroKey", null)}
              className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70 md:h-9"
              aria-label={`Quitar el filtro de cotero ${chipName}`}
            >
              Cotero: {chipName}
              <X className="size-4" aria-hidden />
            </button>
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
            <CoteroList coteros={coteros} onOpen={setOpenCotero} />
          </>
        )}

        {tab === "liquidaciones" && (
          <SettlementList
            rows={shownSettlements}
            receipts={receipts}
            onPay={setPaying}
            onDone={flash}
          />
        )}

        {tab === "tarifas" && <TariffPanel tariffs={tariffs} today={today} onDone={flash} />}
      </div>

      <FlashMessage message={message} />

      <CoteroPanel
        cotero={openSummary}
        onClose={() => setOpenCotero(null)}
        onEdit={setEditing}
        onDelete={setDeleting}
        onSettlements={(c) => {
          setFilters((f) => ({ ...f, coteroKey: c.key }));
          setOpenCotero(null);
          setTab("liquidaciones");
        }}
      />

      <ReceiptEdit row={editing} fleet={fleetControl} onClose={() => setEditing(undefined)} onDone={flash} />

      <ConfirmDeleteDialog
        open={deleting !== undefined}
        title="Eliminar recibo"
        description={deleting && `${deleting.receiptNumber} · ${deleting.coteroName}`}
        warning={
          deleting
            ? `Se eliminará el recibo ${deleting.receiptNumber}${deleting.filePath ? " y su archivo, si ningún otro recibo lo usa" : ""}.${
                deleting.settlementId !== null
                  ? ` También sale de la Liquidación ${deleting.settlementNumber}: su total se recalcula (o se elimina si era su único recibo) y un comprobante ya impreso dejará de coincidir.`
                  : ""
              }`
            : ""
        }
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
        presetIds={settlementIds}
        today={today}
        onDone={(created, settlementId) => {
          flash(created);
          setVoucherOffer(settlementId === null ? null : { id: settlementId, message: created });
          setTab("liquidaciones");
        }}
      />

      <SettlementPay settlement={paying} today={today} onClose={() => setPaying(undefined)} onDone={flash} />
    </section>
  );
}
