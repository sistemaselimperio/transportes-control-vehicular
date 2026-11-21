"use server";

/**
 * Server actions of the deliveries page (deliveries). Each one
 * re-checks the session and the role, parses the form with zod, runs a command and expires the
 * cached reads that show deliveries.
 */
import { expireAfterAction } from "@/lib/cache-invalidation";
import { requireSectionManager } from "@/lib/session";
import { actionFailure } from "@/modules/shared/application/action-failure";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { deliveryRepository } from "../infrastructure/delivery-repository";
import { createDeliveryCommands, DeliveryError } from "./delivery-commands";
import {
  deliveryIdSchema,
  deliverySchema,
  deliveryStatusSchema,
} from "./delivery-schemas";

const deliveries = createDeliveryCommands(deliveryRepository);

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function run(change: "delivery", fn: () => Promise<string>): Promise<ActionResult> {
  try {
    await requireSectionManager("deliveries");
    const message = await fn();
    expireAfterAction({ kind: change });
    return { ok: true, message };
  } catch (e) {
    return actionFailure(e, { label: change, expected: [DeliveryError] });
  }
}

export async function createDeliveryAction(fd: FormData): Promise<ActionResult> {
  return run("delivery", async () => {
    const input = deliverySchema.parse(formValues(fd));
    await deliveries.create(input);
    return `Entrega del ${formatDisplayDate(input.date)} registrada.`;
  });
}

export async function updateDeliveryAction(id: number, fd: FormData): Promise<ActionResult> {
  return run("delivery", async () => {
    const deliveryId = deliveryIdSchema.parse(id);
    const input = deliverySchema.parse(formValues(fd));
    await deliveries.update(deliveryId, input);
    return "Entrega actualizada.";
  });
}

/** Marks a delivery as pendiente or entregado (the toggle of the "Hoy" tab). */
export async function setDeliveryStatusAction(id: number, status: string): Promise<ActionResult> {
  return run("delivery", async () => {
    const next = deliveryStatusSchema.parse(status);
    await deliveries.setStatus(deliveryIdSchema.parse(id), next);
    return next === "entregado" ? "Entrega marcada como entregada." : "Entrega marcada como pendiente.";
  });
}

export async function deleteDeliveryAction(id: number): Promise<ActionResult> {
  return run("delivery", async () => {
    await deliveries.remove(deliveryIdSchema.parse(id));
    return "Entrega eliminada.";
  });
}
