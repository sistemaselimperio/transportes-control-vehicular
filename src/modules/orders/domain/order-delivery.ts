import { remainingBags } from "@/modules/loads/domain/load-balance";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import type { OrderStatus } from "./order-rules";

/** A balance (bags a truck left behind) as the delivery rules need it. */
export interface DeliveryBalance {
  orderId: number;
  bags: number;
  trips: ReadonlyArray<{ bags: number }>;
}

/** An order as the delivery rules need it: its derived status. */
export interface DeliveryOrder {
  id: number;
  status: OrderStatus;
}

/**
 * Why the order cannot be delivered, in Spanish for the user; null when it can. An order is deliverable
 * only when it is completely loaded and none of its balances has bags left to carry.
 */
export function deliveryBlockReason(order: DeliveryOrder, balances: readonly DeliveryBalance[]): string | null {
  if (order.status === "anulado") return `El pedido #${order.id} está anulado.`;
  if (order.status === "entregado") return `El pedido #${order.id} ya está entregado.`;
  if (order.status !== "cargado") return `El pedido #${order.id} aún no está cargado completo.`;
  const left = balances.filter((b) => b.orderId === order.id).reduce((sum, b) => sum + remainingBags(b), 0);
  if (left > 0) return `El pedido #${order.id} tiene ${formatDecimal(left, 0)} ${left === 1 ? "bulto" : "bultos"} de saldo por llevar.`;
  return null;
}

export const canDeliverOrder = (order: DeliveryOrder, balances: readonly DeliveryBalance[]): boolean =>
  deliveryBlockReason(order, balances) === null;
