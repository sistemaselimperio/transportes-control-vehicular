/** Zod schemas that parse the raw values of the order form and of the kg-per-bag field. */
import { z } from "zod";
import { parseDecimal } from "@/modules/shared/domain/decimal";
import { collapseWhitespace } from "@/modules/shared/domain/search-key";
import { dateField, textField } from "@/modules/vehicles/application/vehicle-action-schemas";
import { isValidKgPerBag } from "../domain/order-rules";

export const NOTE_MAX = 500;
export const TIME_WINDOW_MAX = 40;
export const REFERENCE_MAX = 80;
export const MAX_LINES = 100;

const LINES_INVALID = "Las líneas del pedido no son válidas.";

export const orderLineSchema = z.object({
  clientId: z.number(LINES_INVALID).int(LINES_INVALID).positive("Elige el cliente de cada línea."),
  /** Optional finca; the command checks that it belongs to the client. */
  locationId: z.number().int().positive().nullish().transform((v) => v ?? null),
  /** The reference by name: an unknown one is created by the command. */
  reference: z
    .string("Escribe la referencia de cada línea.")
    .transform(collapseWhitespace)
    .refine((v) => v !== "", "Escribe la referencia de cada línea.")
    .refine((v) => v.length <= REFERENCE_MAX, "La referencia no puede pasar de 80 caracteres."),
  bags: z
    .number("Los bultos de cada línea deben ser un número entero mayor que cero.")
    .int("Los bultos de cada línea deben ser un número entero mayor que cero.")
    .positive("Los bultos de cada línea deben ser un número entero mayor que cero.")
    .max(1_000_000, "Los bultos de una línea no pueden pasar de 1.000.000."),
});

/** The lines travel as one JSON field of the form. */
const linesField = z
  .string()
  .default("[]")
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: LINES_INVALID });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(orderLineSchema, LINES_INVALID)
      .min(1, "Agrega al menos una línea al pedido.")
      .max(MAX_LINES, `Un pedido no puede tener más de ${MAX_LINES} líneas.`),
  );

export const orderSchema = z.object({
  deliveryDate: dateField("La fecha de entrega"),
  timeWindow: textField.refine((v) => v === null || v.length <= TIME_WINDOW_MAX, "La ventana horaria no puede pasar de 40 caracteres."),
  note: textField.refine((v) => v === null || v.length <= NOTE_MAX, "La nota no puede pasar de 500 caracteres."),
  lines: linesField,
});

export type OrderInput = z.infer<typeof orderSchema>;
export type OrderLineInput = OrderInput["lines"][number];

export const kgPerBagSchema = z
  .string()
  .default("")
  .transform((v) => parseDecimal(v))
  .refine((v): v is number => v !== null && isValidKgPerBag(v), "Los kg por bulto deben ser un número mayor que cero.")
  .transform((v) => v as number);

export const orderIdSchema = z.number().int().positive();
