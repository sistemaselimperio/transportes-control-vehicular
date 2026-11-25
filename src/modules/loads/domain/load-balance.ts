import { clientNames } from "@/modules/orders/domain/order-days";
import { formatShortDate, type IsoDate } from "@/modules/shared/domain/dates";
import type { PendingOrderRow, PendingSource } from "./load-pending";
import type { LoadSupplier } from "./load-rules";

/*
 * A transport balance: the supplier billed the whole order in one load (SIESA, cost, tons), but the truck
 * carried only part of the bags. The bags left are a transport matter only: they are carried later, in
 * one or more trips, which hold no SIESA, cost or tons.
 */

/** A trip that carried part of a balance. */
export interface BalanceTripRow {
  id: number;
  date: IsoDate;
  plate: string;
  bags: number;
}

/** The bags of an order that a load left behind, with the day (and truck) planned to carry them. */
export interface LoadBalanceRow {
  id: number;
  loadId: number;
  orderId: number;
  supplier: LoadSupplier;
  /** Day of the load that left the bags: the original schedule of the balance. */
  loadDate: IsoDate;
  bags: number;
  scheduledDate: IsoDate;
  /** Optional until a trip is registered. */
  plate: string | null;
  trips: readonly BalanceTripRow[];
}

/** Bags of the balance not carried yet. */
export function remainingBags(balance: Pick<LoadBalanceRow, "bags" | "trips">): number {
  return Math.max(0, balance.bags - balance.trips.reduce((sum, t) => sum + t.bags, 0));
}

export const hasTrips = (balance: Pick<LoadBalanceRow, "trips">): boolean => balance.trips.length > 0;

/** The bags that stay behind: a whole number above zero and below the bags of the order for the supplier. */
export function balanceBagsError(bags: number, orderBags: number): string | null {
  if (Number.isInteger(bags) && bags > 0 && bags < orderBags) return null;
  return `Los bultos que se quedan deben ser un número entero mayor que cero y menor que los ${orderBags} bultos del pedido.`;
}

/** The bags of a trip: a whole number from 1 up to what the balance still has. */
export function tripBagsError(bags: number, remaining: number): string | null {
  if (Number.isInteger(bags) && bags >= 1 && bags <= remaining) return null;
  return `Los bultos del viaje deben ser un número entero entre 1 y ${remaining}.`;
}

/** One balance still to carry, as the pending list shows it. */
export interface PendingBalanceRow {
  balanceId: number;
  loadId: number;
  orderId: number;
  supplier: LoadSupplier;
  clients: string[];
  /** Bags still to carry. */
  remaining: number;
  /** The day it is planned for: the list sorts by it. */
  scheduledDate: IsoDate;
  plate: string | null;
  /** The day of the load that left it. */
  originalDate: IsoDate;
  /** Planned for a day other than the original one. */
  rescheduled: boolean;
  trips: readonly BalanceTripRow[];
}

/** Balances with bags left, by scheduled day (then balance number). Balances of an order that is not listed are left out. */
export function buildPendingBalances(balances: readonly LoadBalanceRow[], orders: readonly PendingSource[]): PendingBalanceRow[] {
  return balances
    .flatMap((b) => {
      const order = orders.find((o) => o.id === b.orderId);
      const remaining = remainingBags(b);
      if (!order || remaining === 0) return [];
      return [
        {
          balanceId: b.id,
          loadId: b.loadId,
          orderId: b.orderId,
          supplier: b.supplier,
          clients: clientNames({ lines: order.lines.filter((l) => l.supplier === b.supplier) }),
          remaining,
          scheduledDate: b.scheduledDate,
          plate: b.plate,
          originalDate: b.loadDate,
          rescheduled: b.scheduledDate !== b.loadDate,
          trips: b.trips,
        },
      ];
    })
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : a.scheduledDate > b.scheduledDate ? 1 : a.balanceId - b.balanceId));
}

export type PendingEntry = { kind: "order"; row: PendingOrderRow } | { kind: "balance"; row: PendingBalanceRow };

/** The pending list: orders by delivery day and balances by scheduled day in one list; on a tie the order goes first. */
export function pendingEntries(orders: readonly PendingOrderRow[], balances: readonly PendingBalanceRow[]): PendingEntry[] {
  const entries: PendingEntry[] = [
    ...orders.map((row) => ({ kind: "order" as const, row })),
    ...balances.map((row) => ({ kind: "balance" as const, row })),
  ];
  const day = (e: PendingEntry) => (e.kind === "order" ? e.row.deliveryDate : e.row.scheduledDate);
  const id = (e: PendingEntry) => (e.kind === "order" ? e.row.id : e.row.balanceId);
  return entries.sort((a, b) => {
    if (day(a) !== day(b)) return day(a) < day(b) ? -1 : 1;
    if (a.kind !== b.kind) return a.kind === "order" ? -1 : 1;
    return id(a) - id(b);
  });
}

/** "Quedan 5 bultos por llevar · 25 nov · ABC-123" (or "sin placa"). */
export function balanceLeftText(row: Pick<PendingBalanceRow, "remaining" | "scheduledDate" | "plate">): string {
  const left = row.remaining === 1 ? "Queda 1 bulto" : `Quedan ${row.remaining} bultos`;
  return `${left} por llevar · ${formatShortDate(row.scheduledDate)} · ${row.plate ?? "sin placa"}`;
}

/** "dd/mm" of an ISO day. */
export function dayMonth(iso: IsoDate): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** What the loader typed for the leftover of one block of the load form. */
export interface BalanceDraft {
  orderId: number;
  supplier: LoadSupplier;
  /** The "Carga incompleta" checkbox. */
  enabled: boolean;
  /** Bags that stay, as typed. */
  bags: string;
  /** Null follows the date of the load. */
  date: IsoDate | null;
  /** Empty for no plate yet. */
  plate: string;
}

/** One unchecked draft per block, filled from the stored balance of that order when there is one. */
export function buildBalanceDrafts(
  blocks: ReadonlyArray<{ orderId: number; supplier: LoadSupplier }>,
  stored: readonly Pick<LoadBalanceRow, "orderId" | "bags" | "scheduledDate" | "plate">[] = [],
): BalanceDraft[] {
  return blocks.map((b) => {
    const before = stored.find((s) => s.orderId === b.orderId);
    return before
      ? { orderId: b.orderId, supplier: b.supplier, enabled: true, bags: String(before.bags), date: before.scheduledDate, plate: before.plate ?? "" }
      : { orderId: b.orderId, supplier: b.supplier, enabled: false, bags: "", date: null, plate: "" };
  });
}

/** What the server would refuse in a checked draft, naming the order; null when fine or unchecked. */
export function balanceDraftError(draft: BalanceDraft, orderBags: number, loadDate: string): string | null {
  if (!draft.enabled) return null;
  const typed = draft.bags.trim();
  const bagsError = balanceBagsError(/^\d+$/.test(typed) ? Number(typed) : Number.NaN, orderBags);
  if (bagsError) return `Pedido #${draft.orderId}: ${bagsError}`;
  if ((draft.date ?? loadDate) === "") return `Pedido #${draft.orderId}: elige la fecha del saldo.`;
  return null;
}
