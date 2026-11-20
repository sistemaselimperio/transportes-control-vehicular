/** Zod schemas that parse the raw form values (strings) of the client and finca forms. */
import { z } from "zod";
import { normalizeNit } from "@/modules/petty-cash/domain/nit";
import { collapseWhitespace, searchKey } from "@/modules/shared/domain/search-key";
import { isHttpUrl, parseMapsCoordinates } from "../domain/maps-link";

export const CLIENT_NAME_MAX = 120;
export const LOCATION_NAME_MAX = 80;

/** Trimmed text where blank means "not provided", capped at `max` characters. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim())
    .refine((v) => v.length <= max, message)
    .transform((v) => (v === "" ? null : v));

/** A required name: spaces collapsed, casing kept, with at least one letter or digit to build its key from. */
const nameField = (required: string, tooLong: string, max: number) =>
  z
    .string()
    .default("")
    .transform(collapseWhitespace)
    .refine((v) => v !== "", required)
    .refine((v) => v.length <= max, tooLong)
    .refine((v) => v === "" || searchKey(v) !== "", "El nombre debe tener letras o números.");

/** Digits with the separators people type ("900.123.456-7"). */
const NIT_CHARACTERS = /^[\d.\-\s]*$/;
const NIT_MESSAGE = "Revisa el NIT: debe tener entre 5 y 15 dígitos.";

export const clientSchema = z
  .object({
    name: nameField("Ingresa el nombre del cliente.", "El nombre del cliente no puede pasar de 120 caracteres.", CLIENT_NAME_MAX),
    nit: z
      .string()
      .default("")
      .transform((v) => v.trim())
      .refine((v) => NIT_CHARACTERS.test(v), NIT_MESSAGE)
      .transform((v) => normalizeNit(v))
      .refine((v) => v === "" || (v.length >= 5 && v.length <= 15), NIT_MESSAGE)
      .transform((v) => (v === "" ? null : v)),
    phone: optionalText(30, "El teléfono no puede pasar de 30 caracteres."),
    notes: optionalText(500, "Las notas no pueden pasar de 500 caracteres."),
  })
  .transform((v) => ({ ...v, nameKey: searchKey(v.name) }));

export type ClientInput = z.infer<typeof clientSchema>;

export const clientIdSchema = z.number().int().positive();

export const locationSchema = z
  .object({
    name: nameField("Ingresa el nombre de la finca.", "El nombre de la finca no puede pasar de 80 caracteres.", LOCATION_NAME_MAX),
    address: optionalText(200, "La dirección no puede pasar de 200 caracteres."),
    mapsUrl: optionalText(2000, "El link de Maps es demasiado largo.").refine(
      (v) => v === null || isHttpUrl(v),
      "El link de Maps no es válido: debe empezar por http:// o https://.",
    ),
  })
  .transform((v) => {
    const coordinates = v.mapsUrl ? parseMapsCoordinates(v.mapsUrl) : null;
    return {
      ...v,
      nameKey: searchKey(v.name),
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
    };
  });

export type LocationInput = z.infer<typeof locationSchema>;

export const locationIdSchema = z.number().int().positive();
