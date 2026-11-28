/** Zod schemas for what the turn actions receive from the browser. */
import { z } from "zod";
import { dateField } from "@/modules/vehicles/application/vehicle-action-schemas";
import { isTimeOfDay } from "../domain/turn-window";

export const PRODUCT_MAX = 200;
export const PLACE_MAX = 200;

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

const requiredText = (label: string, max: number) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim())
    .pipe(z.string().min(1, `${label}: es obligatorio.`).max(max, `${label}: es demasiado largo.`));

const requestFields = {
  product: requiredText("El producto", PRODUCT_MAX),
  destination: requiredText("El lugar", PLACE_MAX),
  neededTime: timeField("La hora"),
};

/** A new request. The vehicle is only for admins (the command refuses it from anyone else); blank means none. */
export const enturnSchema = z.object({
  turnDayId: z.coerce.number().int().positive("La jornada no es válida."),
  ...requestFields,
  vehicleId: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number("Elige un vehículo válido.").int().positive("Elige un vehículo válido.").optional(),
  ),
});

/** Editing the request: product, place and hour. */
export const updateTurnSchema = z.object(requestFields);

/** A vehicle id to assign, or null to go back to pendiente. */
export const assignSchema = idSchema.nullable();
