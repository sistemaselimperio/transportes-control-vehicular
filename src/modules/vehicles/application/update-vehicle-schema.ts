/** Zod schema for the JSON body of `PATCH /api/vehiculos/[placa]` (edit a vehicle). */
import { z } from "zod";
import { isMunicipalityLabel } from "@/modules/shared/domain/municipalities";
import type { VehicleEdit } from "./vehicle-commands";

/** Optional text: absent stays absent, blank or null clears it. */
const text = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v?.trim() ? v.trim() : null));

export const updateVehicleSchema = z
  .strictObject({
    plate: z.string().trim().min(1, "Ingresa la placa.").max(20).optional(),
    classId: z.number().int().positive().optional(),
    brandLine: text,
    notes: text,
    municipality: text.refine((v) => v == null || isMunicipalityLabel(v), "Elige un municipio de la lista."),
    serviceType: z.enum(["PARTICULAR", "PUBLICO"]).optional(),
    oilMode: z.enum(["date", "km", "both"]).optional(),
    /** Null unlinks the towing vehicle. */
    towingPlate: text,
  })
  .transform((v) => Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) as VehicleEdit)
  .refine((v) => Object.keys(v).length > 0, "Envía al menos un campo para editar.");
