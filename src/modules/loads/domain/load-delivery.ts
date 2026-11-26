import { deliveryBlockReason, type DeliveryBalance, type DeliveryOrder } from "@/modules/orders/domain/order-delivery";

export type { DeliveryBalance, DeliveryOrder };

export interface LoadDeliveryState {
  /** Every order still to deliver can be delivered, and there is at least one. */
  deliverable: boolean;
  /** Why not (Spanish); only when the load has orders to deliver and one of them cannot be. */
  reason?: string;
  /** The load has orders and all of them are delivered. */
  delivered: boolean;
}

/**
 * The delivery of a load is the delivery of all its orders at once. A load without orders (a free load)
 * has no delivery. Orders already delivered are left out of the check; the first one that cannot be
 * delivered explains why the load cannot.
 */
export function loadDeliveryState(orders: readonly DeliveryOrder[], balances: readonly DeliveryBalance[]): LoadDeliveryState {
  if (orders.length === 0) return { deliverable: false, delivered: false };
  const open = orders.filter((o) => o.status !== "entregado");
  if (open.length === 0) return { deliverable: false, delivered: true };
  for (const o of open) {
    const reason = deliveryBlockReason(o, balances);
    if (reason !== null) return { deliverable: false, delivered: false, reason };
  }
  return { deliverable: true, delivered: false };
}
