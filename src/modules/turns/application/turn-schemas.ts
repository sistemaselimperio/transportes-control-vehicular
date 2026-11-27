/** Zod schemas for what the turn actions receive from the browser. */
import { z } from "zod";
import { dateField } from "@/modules/vehicles/application/vehicle-action-schemas";
import { isTimeOfDay } from "../domain/turn-window";

export const DESTINATION_MAX = 200;

export const idSchema = z.number().int().positive();

const timeField = (label: string) =>
  z
    .string()
    .default("")
    .refine(isTimeOfDay, `${label}: ingresa una hora válida.`);

/** The opening and closing wall-clock times (Bogotá) of a jornada. */
export const windowTimesSchema = z.object({
  opensTime: timeField("La hora de apertura"),
  closesTime: timeField("La hora de cierre"),
});

export const createDaySchema = windowTimesSchema.extend({
  date: dateField("La fecha"),
});

export const enturnSchema = z.object({
  turnDayId: z.coerce.number().int().positive("La jornada no es válida."),
  vehicleId: z.coerce.number("Elige el vehículo.").int().positive("Elige el vehículo."),
  destination: z.string().max(DESTINATION_MAX, "El destino es demasiado largo.").default(""),
});
