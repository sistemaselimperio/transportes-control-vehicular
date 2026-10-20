/** Zod schema for the JSON body of `POST /api/vehiculos` (create a vehicle). */
import { z } from "zod";
import { isMunicipalityLabel } from "@/modules/shared/domain/municipalities";
import type { NewVehicleInput } from "./vehicle-commands";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa fechas con formato AAAA-MM-DD.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "La fecha no es válida.");

/** Optional trimmed text where blank means "not provided". */
const text = z
  .string()
  .nullish()
  .transform((v) => (v?.trim() ? v.trim() : null));

const count = (max: number) => z.number().int().min(0).max(max).nullish().transform((v) => v ?? null);

const ownerSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("existing"), id: z.number().int().positive(), date: isoDate }),
    z.object({ kind: z.literal("imperio"), date: isoDate }),
    z.object({ kind: z.literal("new"), name: z.string().trim().min(1), documentNumber: text, date: isoDate }),
  ])
  .transform(({ date, ...target }) => ({ target, date }));

const driverSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("existing"), id: z.number().int().positive(), date: isoDate }),
    z.object({
      kind: z.literal("new"),
      name: z.string().trim().min(1),
      nationalId: text,
      phone: text,
      date: isoDate,
    }),
  ])
  .transform(({ date, ...target }) => ({ target, date }));

const documentSchema = z.object({
  type: z.enum(["SOAT", "TECNO", "POLICY"]),
  policyKind: z.enum(["TR", "RC"]).nullish().transform((v) => v ?? null),
  expiresOn: isoDate.nullish().transform((v) => v ?? null),
  notApplicable: z.boolean().default(false),
});

const taxSchema = z.object({
  kind: z.enum(["PAID_YEAR", "EXEMPT", "EXEMPT_LOW_DISPLACEMENT"]),
  year: count(2100),
});

const oilChangeSchema = z
  .object({
    date: isoDate,
    km: count(999_999_999),
    notes: text,
    /** Both null: use the class default interval. */
    intervalMonths: count(120),
    intervalKm: count(999_999),
  })
  .transform(({ intervalMonths, intervalKm, ...oil }) => ({
    ...oil,
    interval:
      intervalMonths == null && intervalKm == null
        ? null
        : { months: intervalMonths, km: intervalKm },
  }));

export const createVehicleSchema = z.object({
  plate: z.string().trim().min(1, "Ingresa la placa.").max(20),
  classId: z.number().int().positive(),
  brandLine: text,
  notes: text,
  municipality: text.refine((v) => v === null || isMunicipalityLabel(v), "Elige un municipio de la lista."),
  serviceType: z.enum(["PARTICULAR", "PUBLICO"]).default("PARTICULAR"),
  status: z.enum(["ACTIVE", "IDLE", "IN_WORKSHOP"]).default("ACTIVE"),
  oilMode: z.enum(["date", "km", "both"]).default("both"),
  odometerWorking: z.boolean().default(true),
  currentKm: count(999_999_999),
  towingPlate: text,
  owner: ownerSchema.nullish().transform((v) => v ?? null),
  driver: driverSchema.nullish().transform((v) => v ?? null),
  documents: z.array(documentSchema).max(10).default([]),
  tax: taxSchema.nullish().transform((v) => v ?? null),
  oilChange: oilChangeSchema.nullish().transform((v) => v ?? null),
}) satisfies z.ZodType<NewVehicleInput, unknown>;
