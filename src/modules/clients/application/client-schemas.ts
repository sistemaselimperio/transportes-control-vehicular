/** Zod schemas that parse the raw form values (strings) of the client form. */
import { z } from "zod";
import { normalizeNit } from "@/modules/petty-cash/domain/nit";
import { titleCase } from "@/modules/shared/domain/title-case";
import { isHttpUrl, parseMapsCoordinates } from "../domain/maps-link";

/** Trimmed text where blank means "not provided", capped at `max` characters. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim())
    .refine((v) => v.length <= max, message)
    .transform((v) => (v === "" ? null : v));

/** Digits with the separators people type ("900.123.456-7"). */
const NIT_CHARACTERS = /^[\d.\-\s]*$/;
const NIT_MESSAGE = "Revisa el NIT: debe tener entre 5 y 15 dígitos.";

export const clientSchema = z
  .object({
    name: z
      .string()
      .default("")
      .transform(titleCase)
      .refine((v) => v !== "", "Ingresa el nombre del cliente."),
    nit: z
      .string()
      .default("")
      .transform((v) => v.trim())
      .refine((v) => NIT_CHARACTERS.test(v), NIT_MESSAGE)
      .transform((v) => normalizeNit(v))
      .refine((v) => v === "" || (v.length >= 5 && v.length <= 15), NIT_MESSAGE)
      .transform((v) => (v === "" ? null : v)),
    phone: optionalText(30, "El teléfono no puede pasar de 30 caracteres."),
    address: optionalText(200, "La dirección no puede pasar de 200 caracteres."),
    mapsUrl: optionalText(2000, "El link de Maps es demasiado largo.").refine(
      (v) => v === null || isHttpUrl(v),
      "El link de Maps no es válido: debe empezar por http:// o https://.",
    ),
    notes: optionalText(500, "Las notas no pueden pasar de 500 caracteres."),
  })
  .transform((v) => {
    const coordinates = v.mapsUrl ? parseMapsCoordinates(v.mapsUrl) : null;
    return { ...v, latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null };
  });

export type ClientInput = z.infer<typeof clientSchema>;

export const clientIdSchema = z.number().int().positive();
