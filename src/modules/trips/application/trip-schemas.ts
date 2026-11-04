/** Zod schemas that parse the raw form values (strings) of the trip form. */
import { z } from "zod";
import { isMunicipalityLabel } from "@/modules/shared/domain/municipalities";
import { normalizePlate } from "@/modules/vehicles/domain/plate";
import { TRIP_AREAS } from "../domain/trip-areas";
import { parseLocalInput } from "../domain/trip-datetime";
import { TRIP_STATUSES } from "../domain/trip-status";

/** A required municipality label ("Tunja (Boyacá)") picked from the list. */
const municipalityField = (message: string) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim())
    .refine(isMunicipalityLabel, message);

export const tripSchema = z.object({
  startAt: z
    .string("Ingresa la fecha de inicio.")
    .transform((v) => parseLocalInput(v))
    .refine((v): v is Date => v !== null, "Ingresa una fecha de inicio válida.")
    .transform((v) => v as Date),
  origin: municipalityField("Elige el municipio de salida."),
  destination: municipalityField("Elige el municipio de destino."),
  plate: z
    .string()
    .default("")
    .transform((v) => (v.trim() === "" ? "" : normalizePlate(v)))
    .refine((v) => v !== "", "Elige la placa del vehículo."),
  area: z.enum(TRIP_AREAS, "Elige el área."),
  status: z
    .string()
    .default("")
    .transform((v) => (v === "" ? "programado" : v))
    .pipe(z.enum(TRIP_STATUSES, "Estado no válido.")),
});

export type TripInput = z.infer<typeof tripSchema>;

export const tripIdSchema = z.number().int().positive();
