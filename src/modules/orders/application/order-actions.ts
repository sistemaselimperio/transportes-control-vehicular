"use server";

/**
 * Server actions of the orders page. Each one re-checks the session and the role, parses the form
 * with zod, runs a command and expires the cached reads that show orders.
 */
import { expireAfterAction } from "@/lib/cache-invalidation";
import { requireOrderDeliverer, requireSectionManager } from "@/lib/session";
import { actionFailure } from "@/modules/shared/application/action-failure";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { orderRepository } from "../infrastructure/order-repository";
import { createOrderCommands, OrderError } from "./order-commands";
import { deliveryDaySchema, deliveryIdsSchema, kgPerBagSchema, orderIdSchema, orderSchema } from "./order-schemas";

const commands = createOrderCommands(orderRepository);

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    // Only whoever manages the orders writes them: the loader reads them and the dispatcher manages them.
    await requireSectionManager("orders");
    const message = await fn();
    expireAfterAction({ kind: "order" });
    return { ok: true, message };
  } catch (e) {
    return actionFailure(e, { label: "order", expected: [OrderError] });
  }
}

export async function createOrderAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const id = await commands.create(orderSchema.parse(formValues(fd)));
    return `Pedido #${id} registrado.`;
  });
}

export async function updateOrderAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const orderId = orderIdSchema.parse(id);
    await commands.update(orderId, orderSchema.parse(formValues(fd)));
    return `Pedido #${orderId} actualizado.`;
  });
}

export async function annulOrderAction(id: number): Promise<ActionResult> {
  return run(async () => {
    const orderId = orderIdSchema.parse(id);
    await commands.annul(orderId);
    return `Pedido #${orderId} anulado.`;
  });
}

/** The kilograms per bag: same guard as the orders, since only whoever manages them may change it. */
export async function setKgPerBagAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const value = kgPerBagSchema.parse(fd.get("kgPerBag") ?? "");
    await commands.setKgPerBag(value);
    return "Kg por bulto actualizado. Los pesos se recalcularon.";
  });
}

/**
 * Delivery has its own guard: whoever manages the orders or the loads may deliver (the loader does not
 * edit orders). The commands re-validate every order, so a stale screen cannot deliver what is not ready.
 */
async function runDelivery(fn: (userId: string) => Promise<string>): Promise<ActionResult> {
  try {
    const session = await requireOrderDeliverer();
    const message = await fn(session.user.id);
    // A delivery changes the orders and the loads that list them.
    expireAfterAction({ kind: "load" });
    return { ok: true, message };
  } catch (e) {
    return actionFailure(e, { label: "order delivery", expected: [OrderError] });
  }
}

const deliveredMessage = (count: number) => (count === 1 ? "Pedido entregado." : `${count} pedidos entregados.`);

/** Marks orders as delivered on a day (default today is chosen by the form). */
export async function deliverOrdersAction(ids: number[], date: string): Promise<ActionResult> {
  return runDelivery(async (userId) => deliveredMessage(await commands.deliver(deliveryIdsSchema.parse(ids), deliveryDaySchema.parse(date), userId)));
}

export async function undoOrdersDeliveryAction(ids: number[]): Promise<ActionResult> {
  return runDelivery(async () => {
    await commands.undoDelivery(deliveryIdsSchema.parse(ids));
    return "Entrega deshecha.";
  });
}

/** All the orders of a load at once, or none. */
export async function deliverLoadAction(loadId: number, date: string): Promise<ActionResult> {
  return runDelivery(async (userId) =>
    deliveredMessage(await commands.deliverLoad(orderIdSchema.parse(loadId), deliveryDaySchema.parse(date), userId)),
  );
}

export async function undoLoadDeliveryAction(loadId: number): Promise<ActionResult> {
  return runDelivery(async () => {
    await commands.undoLoadDelivery(orderIdSchema.parse(loadId));
    return "Entrega deshecha.";
  });
}
