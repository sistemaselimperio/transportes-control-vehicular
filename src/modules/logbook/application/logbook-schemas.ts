/** Zod schemas that parse the raw form values (strings) of the logbook forms. */
import { z } from "zod";
import { dateField, intField, plateSchema, textField } from "@/modules/vehicles/application/vehicle-action-schemas";

/** Required trimmed text. */
const requiredText = (message: string) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim())
    .refine((v) => v !== "", message);

const price = intField("El precio");

/** Required whole number greater than zero, up to `max`. */
const positiveInt = (label: string, message: string, max: number) =>
  intField(label, max).pipe(z.number(message).positive(message));

const serviceBody = z.object({
  date: dateField("Fecha"),
  kind: z.enum(["PREVENTIVE", "CORRECTIVE"], "Elige el tipo de mantenimiento."),
  description: requiredText("Describe el mantenimiento."),
  provider: textField,
  km: intField("El kilometraje", 999_999_999),
  price,
  notes: textField,
});

const tireBody = z.object({
  date: dateField("Fecha"),
  quantity: positiveInt("La cantidad", "Ingresa la cantidad de llantas (de 1 a 50).", 50),
  reference: requiredText("Ingresa el detalle de la llanta."),
  provider: textField,
  price,
  notes: textField,
});

/** Gallons: up to four digits and two decimals, with a comma or a dot as the separator. */
const gallons = z
  .string()
  .default("")
  .transform((v) => v.trim().replace(",", "."))
  .refine((v) => /^\d{1,4}(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Ingresa la cantidad (por ejemplo, 45,5).")
  .transform(Number);

const fuelBody = z.object({
  date: dateField("Fecha"),
  gallons,
  amount: positiveInt("El valor", "Ingresa el valor pagado.", 2_000_000_000),
  provider: textField,
});

/** Creating needs the vehicle; editing keeps the one the record already has. */
const withPlate = { plate: plateSchema };

export const serviceSchema = serviceBody.extend(withPlate);
export const serviceEditSchema = serviceBody;
export const tireSchema = tireBody.extend(withPlate);
export const tireEditSchema = tireBody;
export const fuelSchema = fuelBody.extend(withPlate);
export const fuelEditSchema = fuelBody;

export type ServiceInput = z.infer<typeof serviceEditSchema>;
export type TireInput = z.infer<typeof tireEditSchema>;
export type FuelInput = z.infer<typeof fuelEditSchema>;

export const entryIdSchema = z.number().int().positive();
