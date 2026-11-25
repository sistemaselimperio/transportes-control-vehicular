/** Zod schemas for what the cotero-payment actions receive from the browser. */
import { z } from "zod";
import { dateField } from "@/modules/vehicles/application/vehicle-action-schemas";
import { parseCop } from "../domain/parse-values";
import { isProofPath, isReceiptFilePath } from "../domain/receipt-files";
import { PAYMENT_METHODS } from "../domain/settlement-rules";

const text = (max: number, label: string) =>
  z.string().max(max, `${label} es demasiado largo.`).default("");

/** The text fields of a receipt, as typed or read by the AI. Validation of their content is `parseDraft`'s. */
export const receiptDraftSchema = z.object({
  receiptNumber: text(30, "El número de recibo"),
  date: text(10, "La fecha"),
  destination: text(200, "El destino"),
  remissions: text(300, "Las remisiones"),
  tons: text(30, "Las toneladas"),
  vehiclePlate: text(20, "La placa"),
  trailerPlate: text(20, "La placa del trailer"),
  crew: text(40, "La cuadrilla"),
  coteroName: text(120, "El nombre del cotero"),
  coteroDocument: text(30, "La cédula"),
  driverName: text(120, "El nombre del conductor"),
  amount: text(30, "La liquidación"),
});

const FILE_INVALID = "El archivo del recibo no es válido. Súbelo de nuevo.";

/** A draft of the batch to save, with where its original file lives. */
export const receiptBatchItemSchema = receiptDraftSchema.extend({
  filePath: z
    .string()
    .nullable()
    .default(null)
    .refine((v) => v === null || isReceiptFilePath(v), FILE_INVALID),
  pageNumber: z.number().int().min(1).max(500).nullable().default(null),
});

export const MAX_BATCH = 100;

export const receiptBatchSchema = z
  .array(receiptBatchItemSchema, "Los recibos no son válidos.")
  .min(1, "Agrega al menos un recibo.")
  .max(MAX_BATCH, `Se pueden guardar hasta ${MAX_BATCH} recibos a la vez.`);

export type ReceiptBatchItem = z.infer<typeof receiptBatchItemSchema>;

export const idSchema = z.number().int().positive();

const PRICE_INVALID = "Ingresa el valor por tonelada en pesos.";

export const tariffSchema = z.object({
  validFrom: dateField("La fecha desde la que rige"),
  pricePerTon: z
    .string(PRICE_INVALID)
    .default("")
    .transform((v) => parseCop(v))
    .refine((v): v is number => v !== null, PRICE_INVALID)
    .transform((v) => v as number),
});

export type TariffInput = z.infer<typeof tariffSchema>;

const paymentMethod = z.enum(PAYMENT_METHODS, "Elige cómo se paga.");

/** Blank text means "not provided". */
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .default("")
    .transform((v) => v.trim())
    .transform((v) => (v === "" ? null : v));

export const settlementSchema = z.object({
  coteroKey: z.string().min(1, "Elige el cotero.").max(200),
  receiptIds: z
    .array(idSchema, "Los recibos no son válidos.")
    .min(1, "Elige al menos un recibo.")
    .max(500)
    .transform((ids) => [...new Set(ids)]),
  document: z.string().max(30).default(""),
  paymentMethod: z.union([paymentMethod, z.literal("")]).default("").transform((v) => (v === "" ? null : v)),
  paymentAccount: optionalText(100),
});

export type SettlementInput = z.infer<typeof settlementSchema>;

export const paySchema = z.object({
  paidAt: dateField("La fecha de pago"),
  paymentMethod,
  proofPath: z
    .string()
    .nullable()
    .default(null)
    .refine((v) => v === null || isProofPath(v), "El comprobante no es válido. Súbelo de nuevo."),
});

export type PayInput = z.infer<typeof paySchema>;

export const uploadRequestSchema = z
  .array(
    z.object({
      kind: z.enum(["receipt", "proof"]),
      mimeType: z.string().max(100),
      size: z.number().int().min(0),
    }),
  )
  .min(1)
  .max(30);

export type UploadRequest = z.infer<typeof uploadRequestSchema>[number];

export const pathListSchema = z.array(z.string().max(200)).max(60);
export const numberListSchema = z.array(z.string().max(60)).max(MAX_BATCH);
