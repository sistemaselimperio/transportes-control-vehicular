"use server";

/**
 * Server actions of the orders page. Each one re-checks the session and the role, parses the form
 * with zod, runs a command and expires the cached reads that show orders.
 */
import { expireAfterAction } from "@/lib/cache-invalidation";
import { requireSectionManager } from "@/lib/session";
import { actionFailure } from "@/modules/shared/application/action-failure";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { orderRepository } from "../infrastructure/order-repository";
import { createOrderCommands, OrderError } from "./order-commands";
import { kgPerBagSchema, orderIdSchema, orderSchema } from "./order-schemas";

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
