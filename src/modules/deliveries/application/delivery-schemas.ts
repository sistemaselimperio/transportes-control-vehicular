/** Zod schemas that parse the raw form values (strings) of the delivery and destination forms. */
import { z } from "zod";
import { parseDecimal } from "@/modules/shared/domain/decimal";
import { titleCase } from "@/modules/shared/domain/title-case";
import { dateField, textField } from "@/modules/vehicles/application/vehicle-action-schemas";
import { normalizePlate } from "@/modules/vehicles/domain/plate";
import { DELIVERY_PRIORITIES, DELIVERY_SHIFTS, DELIVERY_STATUSES } from "../domain/delivery-rules";

export const NOTES_MAX = 500;
export const DESTINATION_NAME_MAX = 60;

/** A positive integer id coming from a select (a string in the form data). */
const idField = (message: string) =>
  z
    .string(message)
    .default("")
    .transform((v) => v.trim())
    .refine((v) => /^\d{1,10}$/.test(v) && Number(v) > 0, message)
    .transform(Number);

/** An optional id coming from a select: blank means none. */
const optionalIdField = (message: string) =>
  z
    .string(message)
    .default("")
    .transform((v) => v.trim())
    .refine((v) => v === "" || (/^\d{1,10}$/.test(v) && Number(v) > 0), message)
    .transform((v) => (v === "" ? null : Number(v)));

export const deliverySchema = z.object({
  date: dateField("La fecha"),
  shift: z.enum(DELIVERY_SHIFTS, "Elige el turno."),
  priority: z
    .string()
    .default("")
    .transform((v) => (v === "" ? "normal" : v))
    .pipe(z.enum(DELIVERY_PRIORITIES, "Elige la prioridad.")),
  clientId: idField("Elige el cliente."),
  /** Finca of the client where the delivery goes; checked against the client by the command. */
  locationId: optionalIdField("La finca no es válida."),
  destinationId: idField("Elige el destino."),
  quantity: z
    .string()
    .default("")
    .transform((v) => v.trim())
    .refine((v) => /^\d{1,9}$/.test(v) && Number(v) > 0, "La cantidad de bultos debe ser un número entero mayor que cero.")
    .transform(Number),
  /** Typed by hand: the weight never follows the number of bags. */
  weightKg: z
    .string()
    .default("")
    .transform((v) => parseDecimal(v))
    .refine((v): v is number => v !== null && v > 0 && v < 1e9, "El peso en kg debe ser un número mayor que cero.")
    .transform((v) => v as number),
  plate: z
    .string()
    .default("")
    .transform((v) => (v.trim() === "" ? null : normalizePlate(v))),
  notes: textField.refine((v) => v === null || v.length <= NOTES_MAX, "La observación no puede pasar de 500 caracteres."),
});

export type DeliveryInput = z.infer<typeof deliverySchema>;

export const deliveryStatusSchema = z.enum(DELIVERY_STATUSES, "Estado no válido.");

export const deliveryIdSchema = z.number().int().positive();

export const destinationSchema = z.object({
  name: z
    .string()
    .default("")
    .transform(titleCase)
    .refine((v) => v !== "", "Ingresa el nombre del destino.")
    .refine((v) => v.length <= DESTINATION_NAME_MAX, "El nombre del destino no puede pasar de 60 caracteres."),
});

export type DestinationInput = z.infer<typeof destinationSchema>;

export const destinationIdSchema = z.number().int().positive();
