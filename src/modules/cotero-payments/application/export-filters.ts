/** The receipt filters as query parameters: the list's "Exportar" link and the export route share them. */
import { NO_RECEIPT_FILTERS, type ReceiptFilters } from "../domain/receipt-rules";
import type { ReceiptStatus } from "../domain/settlement-rules";

const STATUSES: readonly ReceiptStatus[] = ["pending", "settled", "paid"];

const isIsoDate = (value: string | null): value is string => {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
};

export function receiptFiltersFromParams(params: URLSearchParams): ReceiptFilters {
  const from = params.get("desde");
  const to = params.get("hasta");
  const status = params.get("estado");
  return {
    from: isIsoDate(from) ? from : null,
    to: isIsoDate(to) ? to : null,
    coteroKey: params.get("cotero") || null,
    status: STATUSES.find((s) => s === status) ?? null,
    plate: params.get("placa") ?? NO_RECEIPT_FILTERS.plate,
    destination: params.get("destino") ?? NO_RECEIPT_FILTERS.destination,
  };
}

export function receiptFiltersToParams(filters: ReceiptFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.from) params.set("desde", filters.from);
  if (filters.to) params.set("hasta", filters.to);
  if (filters.coteroKey) params.set("cotero", filters.coteroKey);
  if (filters.status) params.set("estado", filters.status);
  if (filters.plate.trim() !== "") params.set("placa", filters.plate.trim());
  if (filters.destination.trim() !== "") params.set("destino", filters.destination.trim());
  return params;
}
