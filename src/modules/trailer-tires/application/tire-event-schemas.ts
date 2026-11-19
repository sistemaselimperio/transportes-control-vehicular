/** Zod schema that parses the raw form values (strings) of the trailer tire event forms. */
import { z } from "zod";
import { dateField, intField, textField } from "@/modules/vehicles/application/vehicle-action-schemas";
import { TIRE_POSITION_CODES } from "../domain/tire-positions";

const requiredText = (message: string) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim())
    .refine((v) => v !== "", message);

const position = (message: string) => z.enum(TIRE_POSITION_CODES, message);

/** Optional non-negative decimal with up to `digits` integer digits and one decimal; comma or dot. */
const optionalDecimal = (message: string, digits: number) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim().replace(",", "."))
    .refine((v) => v === "" || new RegExp(`^\\d{1,${digits}}(\\.\\d)?$`).test(v), message)
    .transform((v) => (v === "" ? null : Number(v)));

const optionalCondition = z
  .string()
  .default("")
  .refine((v) => v === "" || v === "GOOD" || v === "FAIR" || v === "BAD", "Elige el estado de la llanta.")
  .transform((v) => (v === "" ? null : (v as "GOOD" | "FAIR" | "BAD")));

const common = {
  date: dateField("Fecha"),
  position: position("Elige una posición válida."),
};

export const tireEventSchema = z.discriminatedUnion("type", [
  z.object({
    ...common,
    type: z.literal("CHANGE"),
    reference: requiredText("Ingresa la referencia de la llanta."),
    provider: textField,
    price: intField("El precio"),
    notes: textField,
  }),
  z.object({
    ...common,
    type: z.literal("REPAIR"),
    provider: textField,
    price: intField("El precio"),
    notes: requiredText("Describe la reparación (por ejemplo, parche por pinchazo)."),
  }),
  z.object({
    ...common,
    type: z.literal("ROTATION"),
    counterpart: position("Elige una posición válida para la rotación."),
    notes: textField,
  }),
  z.object({
    ...common,
    type: z.literal("INSPECTION"),
    treadDepthMm: optionalDecimal("La profundidad debe ser un número (por ejemplo, 8,5).", 2),
    pressurePsi: optionalDecimal("La presión debe ser un número (por ejemplo, 95).", 3),
    condition: optionalCondition,
    notes: textField,
  }),
]);

export type TireEventInput = z.infer<typeof tireEventSchema>;

export const tireEventIdSchema = z.number().int().positive();
