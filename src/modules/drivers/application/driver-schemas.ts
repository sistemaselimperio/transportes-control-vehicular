/** Zod schemas that parse the raw form values (strings) of the driver forms. */
import { z } from "zod";
import { titleCase } from "@/modules/shared/domain/title-case";

/** Trimmed text where blank means "not provided". */
const textField = z
  .string()
  .default("")
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? null : v));

export const driverSchema = z.object({
  name: z
    .string()
    .default("")
    .transform(titleCase)
    .refine((v) => v !== "", "Ingresa el nombre del conductor."),
  nationalId: textField
    .transform((v) => v?.replace(/[.\s]/g, "") ?? null)
    .refine((v) => v === null || /^\d{4,12}$/.test(v), "La cédula debe tener solo números."),
  phone: textField
    .transform((v) => v?.replace(/\D/g, "").replace(/^57(?=\d{10}$)/, "") ?? null)
    .refine((v) => v === null || /^\d{10}$/.test(v), "El celular debe tener 10 dígitos."),
  company: textField.pipe(z.enum(["IMPERIO", "PAEZ", "THIRD_PARTY"], "Empresa no válida.").nullable()),
  status: z.enum(["ACTIVE", "IN_WORKSHOP", "INACTIVE"], "Elige el estado."),
});

export type DriverInput = z.infer<typeof driverSchema>;

export const driverIdSchema = z.number().int().positive();
