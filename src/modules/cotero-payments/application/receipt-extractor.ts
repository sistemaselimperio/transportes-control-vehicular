/**
 * Port that reads the receipts on a photo of a page (an AI model behind it), with the shape of its
 * answer and the prompt. The model fills every field; what it cannot read is null (or an empty list).
 */
import { z } from "zod";
import { parseColombianDate } from "../domain/parse-date";
import type { ReceiptDraft } from "../domain/receipt-rules";
import { CoteroError } from "../domain/settlement-rules";

export const extractedReceiptSchema = z.object({
  /** The consecutive number as written ("T 0248"). */
  receiptNumber: z.string().nullable(),
  /** DD/MM/YYYY as written. */
  date: z.string().nullable(),
  destination: z.string().nullable(),
  remissions: z.array(z.string()),
  /** Always in tons: kilograms are converted by the model. */
  tons: z.number().nullable(),
  vehiclePlate: z.string().nullable(),
  trailerPlate: z.string().nullable(),
  crew: z.string().nullable(),
  coteroName: z.string().nullable(),
  /** The cédula written next to the signature. */
  coteroDocument: z.string().nullable(),
  driverName: z.string().nullable(),
  /** The LIQUIDACIÓN in whole Colombian pesos. */
  amount: z.number().int().nullable(),
});

export const extractionSchema = z.object({ receipts: z.array(extractedReceiptSchema) });

export type ExtractedReceipt = z.infer<typeof extractedReceiptSchema>;
export type ExtractionOutput = z.infer<typeof extractionSchema>;

/** One page rendered for reading: a sharp JPEG, not the stored file. */
export interface ReceiptImage {
  mimeType: "image/jpeg";
  data: Buffer;
}

export interface ReceiptExtractor {
  extract(image: ReceiptImage): Promise<ExtractionOutput>;
}

/** The AI is not set up (no API key): the user is told, nothing is logged as a failure. */
export class ExtractorNotConfiguredError extends Error {}

/** The model failed, refused or answered something unusable. */
export class ExtractionFailedError extends Error {}

export const EXTRACTION_PROMPT = `Eres un asistente administrativo de una empresa de transporte en Colombia. Lees fotos de hojas con recibos de caja menor escritos a mano ("RECIBO DE CAJA MENOR") con los que se paga a los coteros por descargar un vehículo, y devuelves un recibo por cada formato que veas. Una hoja puede traer uno o varios recibos.

Campos de cada recibo:
- "receiptNumber": el consecutivo impreso o escrito, como "T 0248" o "T 428". Cópialo tal cual.
- "date": la fecha (DÍA / MES / AÑO) en formato DD/MM/AAAA.
- "destination": el "DESTINO DE DESCARGUE".
- "remissions": los números de remisión ("NÚMERO DE REMISIÓN"). Puede haber varios, por ejemplo "44092 une 440493-440491" son "44092", "440493" y "440491". Una lista vacía si no hay.
- "tons": el "TOTAL DE TONELADAS" como número en TONELADAS. En este formato el punto separa los decimales de las toneladas ("33.213" es 33.213 toneladas). Si está escrito en kilos (por ejemplo "12.880 Kg"), conviértelo a toneladas (12.88).
- "vehiclePlate": la "PLACA DEL VEHÍCULO": 3 letras y 3 números ("ABC123").
- "trailerPlate": la "PLACA DEL TRAILER", por ejemplo "R 21396". Null si está vacía.
- "crew": la "CUADRILLA" (por ejemplo "H2"). Null si está vacía.
- "coteroName": el "NOMBRE COTERO".
- "coteroDocument": la cédula escrita junto a la FIRMA del cotero, solo dígitos (por ejemplo 1056507092). Null si no aparece.
- "driverName": el "NOMBRE DEL CONDUCTOR".
- "amount": la "LIQUIDACIÓN" en pesos colombianos como número entero. Los puntos y los apóstrofes separan miles ("$325'498" es 325498 y "$126.224" es 126224).

Reglas:
- La letra es a mano y en español de Colombia: léela con cuidado, pero nunca inventes datos. Lo que no puedas leer con seguridad es null (o una lista vacía en "remissions").
- No copies un dato de un recibo a otro: cada recibo se lee por separado.
- Si la imagen no tiene recibos, devuelve "receipts" vacío.`;

const optional = (text: string | null) => text ?? "";

/** What the model read as the text of the review form (the same strings a person would type). */
export function toDraft(item: ExtractedReceipt): ReceiptDraft {
  return {
    receiptNumber: optional(item.receiptNumber),
    date: parseColombianDate(optional(item.date)),
    destination: optional(item.destination),
    remissions: item.remissions.join(" "),
    tons: item.tons === null ? "" : String(item.tons),
    vehiclePlate: optional(item.vehiclePlate),
    trailerPlate: optional(item.trailerPlate),
    crew: optional(item.crew),
    coteroName: optional(item.coteroName),
    coteroDocument: optional(item.coteroDocument),
    driverName: optional(item.driverName),
    amount: item.amount === null ? "" : String(item.amount),
  };
}

/** Reads the receipts of one page image; failures become messages meant for the user. */
export async function extractReceiptDrafts(extractor: ReceiptExtractor, image: ReceiptImage): Promise<ReceiptDraft[]> {
  try {
    const output = await extractor.extract(image);
    return output.receipts.map(toDraft);
  } catch (e) {
    if (e instanceof ExtractorNotConfiguredError) throw new CoteroError("La lectura con IA no está configurada.");
    console.error("receipt extraction failed", e);
    throw new CoteroError("No se pudo leer la hoja con IA. Intenta de nuevo o agrega los recibos a mano.");
  }
}
