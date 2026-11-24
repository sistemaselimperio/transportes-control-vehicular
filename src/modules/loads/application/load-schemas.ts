/** Zod schema that parses the raw form values (strings) of the load form. */
import { z } from "zod";
import { parseDecimal } from "@/modules/shared/domain/decimal";
import { dateField, textField } from "@/modules/vehicles/application/vehicle-action-schemas";
import { normalizePlate } from "@/modules/vehicles/domain/plate";
import { firstDuplicate } from "../domain/load-lines";
import { LOAD_SUPPLIERS } from "../domain/load-rules";

export const NOTES_MAX = 500;
export const REFERENCE_MAX = 40;
export const MAX_LINES = 50;

const LINES_INVALID = "Los productos del cargue no son válidos.";

/** A required number typed by hand (SIESA, supplier order): trimmed and capped. */
const reference = (missing: string) =>
  z
    .string(missing)
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

const PRODUCT_MISSING = "Elige el producto de cada línea.";
const TONS_INVALID = "Las toneladas de cada producto deben ser un número mayor que cero.";

/** One product of the load; the form sends every value as text. */
export const loadLineSchema = z.object({
  /** The catalog product; the command checks that it exists and belongs to the load's supplier. */
  referenceId: z.number(PRODUCT_MISSING).int(PRODUCT_MISSING).positive(PRODUCT_MISSING),
  tons: z
    .string(TONS_INVALID)
    .transform((v) => parseDecimal(v))
    .refine((v): v is number => v !== null && v > 0 && v < 1e7, TONS_INVALID)
    .transform((v) => v as number),
  /** Whole pesos; the form types them with "$" and thousands separators. */
  cost: z
    .string("Ingresa el costo en pesos de cada producto.")
    .transform((v) => v.replace(/[$\s.,]/g, ""))
    .refine((v) => v !== "", "Ingresa el costo en pesos de cada producto.")
    .refine((v) => /^\d{1,13}$/.test(v), "El costo debe ser un valor en pesos, sin decimales.")
    .transform(Number),
  siesaNumber: reference("Ingresa el número SIESA de cada producto."),
  orderNumber: reference("Ingresa el número de pedido de cada producto."),
});

/** The lines travel as one JSON field of the form; a SIESA number cannot repeat among them. */
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
      .array(loadLineSchema, LINES_INVALID)
      .min(1, "Agrega al menos un producto al cargue.")
      .max(MAX_LINES, `Un cargue no puede tener más de ${MAX_LINES} productos.`)
      .superRefine((lines, ctx) => {
        const duplicate = firstDuplicate(lines.map((l) => l.siesaNumber));
        if (duplicate !== null) ctx.addIssue({ code: "custom", message: `El número SIESA ${duplicate} está repetido en el cargue.` });
      }),
  );

export const loadSchema = z.object({
  date: dateField("La fecha"),
  supplier: z.enum(LOAD_SUPPLIERS, "Elige el proveedor."),
  plate: z
    .string()
    .default("")
    .transform((v) => (v.trim() === "" ? "" : normalizePlate(v)))
    .refine((v) => v !== "", "Elige la placa del vehículo."),
  notes: textField.refine((v) => v === null || v.length <= NOTES_MAX, "La observación no puede pasar de 500 caracteres."),
  /** Concentrate orders (pedidos) this load picks up; optional. */
  orderIds: orderIdsField,
  /** The products of the load, each with its own tons, cost, SIESA and supplier order number. */
  lines: linesField,
});

export type LoadInput = z.infer<typeof loadSchema>;
export type LoadLineInput = LoadInput["lines"][number];

export const loadIdSchema = z.number().int().positive();
