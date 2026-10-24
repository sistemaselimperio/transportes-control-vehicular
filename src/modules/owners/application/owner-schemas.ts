/** Zod schemas that parse the raw form values (strings) of the owner forms. */
import { z } from "zod";
import { titleCase } from "@/modules/shared/domain/title-case";

/** Trimmed text where blank means "not provided". */
const textField = z
  .string()
  .default("")
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? null : v));

export const ownerSchema = z.object({
  name: z
    .string()
    .default("")
    .transform(titleCase)
    .refine((v) => v !== "", "Ingresa el nombre del propietario."),
  documentNumber: textField
    .transform((v) => v?.replace(/[.\s]/g, "") ?? null)
    .refine((v) => v === null || /^\d{4,15}$/.test(v), "El documento debe tener solo números."),
  group: z.enum(["IMPERIO", "PAEZ", "THIRD_PARTY"], "Elige el grupo."),
});

export type OwnerInput = z.infer<typeof ownerSchema>;

export const ownerIdSchema = z.number().int().positive();
