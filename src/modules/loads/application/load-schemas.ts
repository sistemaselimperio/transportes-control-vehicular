/** Zod schema that parses the raw form values (strings) of the load form. */
import { z } from "zod";
import { parseDecimal } from "@/modules/shared/domain/decimal";
import { dateField, textField } from "@/modules/vehicles/application/vehicle-action-schemas";
import { normalizePlate } from "@/modules/vehicles/domain/plate";
import { LOAD_SUPPLIERS } from "../domain/load-rules";

export const NOTES_MAX = 500;
export const REFERENCE_MAX = 40;

/** A required reference typed by hand (SIESA, order): trimmed and capped. */
const reference = (missing: string) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim())
    .refine((v) => v !== "", missing)
    .refine((v) => v.length <= REFERENCE_MAX, "El número no puede pasar de 40 caracteres.");

/** The checked orders of the form: ids as strings, unique and positive. */
const orderIdsField = z
  .array(z.string())
  .default([])
  .refine((ids) => ids.every((v) => /^\d{1,10}$/.test(v.trim()) && Number(v) > 0), "Alguno de los pedidos elegidos no es válido.")
  .transform((ids) => [...new Set(ids.map((v) => Number(v)))]);

export const loadSchema = z.object({
  date: dateField("La fecha"),
  supplier: z.enum(LOAD_SUPPLIERS, "Elige el proveedor."),
  plate: z
    .string()
    .default("")
    .transform((v) => (v.trim() === "" ? "" : normalizePlate(v)))
    .refine((v) => v !== "", "Elige la placa del vehículo."),
  tons: z
    .string()
    .default("")
    .transform((v) => parseDecimal(v))
    .refine((v): v is number => v !== null && v > 0 && v < 1e7, "Las toneladas deben ser un número mayor que cero.")
    .transform((v) => v as number),
  /** Whole pesos; the form types them with "$" and thousands separators. */
  cost: z
    .string()
    .default("")
    .transform((v) => v.replace(/[$\s.,]/g, ""))
    .refine((v) => v !== "", "Ingresa el costo en pesos.")
    .refine((v) => /^\d{1,13}$/.test(v), "El costo debe ser un valor en pesos, sin decimales.")
    .transform(Number),
  siesaNumber: reference("Ingresa el número SIESA."),
  orderNumber: reference("Ingresa el número de pedido."),
  notes: textField.refine((v) => v === null || v.length <= NOTES_MAX, "La observación no puede pasar de 500 caracteres."),
  /** Concentrate orders (pedidos) this load picks up; optional. */
  orderIds: orderIdsField,
});

export type LoadInput = z.infer<typeof loadSchema>;

export const loadIdSchema = z.number().int().positive();
