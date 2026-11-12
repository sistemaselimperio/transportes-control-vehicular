/**
 * Port that reads the expenses of a photo or PDF of invoices (an AI model behind it), with the
 * shape of its answer and the prompt. The model fills every field; what it cannot read is null.
 */
import { z } from "zod";

export const extractedExpenseSchema = z.object({
  /** Short description of the purchase or service. */
  detail: z.string(),
  invoiceNumber: z.string().nullable(),
  /** NIT of the issuing supplier, without the verification digit. */
  supplierNit: z.string().nullable(),
  supplierName: z.string().nullable(),
  /** The party the invoice is billed to, as written. */
  billedTo: z.string().nullable(),
  /** Id of the matching owner in the list given in the prompt. */
  ownerId: z.number().int().nullable(),
  isElectronicInvoice: z.boolean(),
  vehiclePlate: z.string().nullable(),
  /** Id of the matching fleet vehicle in the list given in the prompt. */
  vehicleId: z.number().int().nullable(),
  /** Total in whole Colombian pesos. */
  value: z.number().int().nullable(),
  /** 1-based pages of the PDF that make up this invoice; [1] for a photo. */
  pages: z.array(z.number().int()),
});

export const extractionSchema = z.object({
  expenses: z.array(extractedExpenseSchema),
  unreadablePages: z.array(z.number().int()),
});

export type ExtractedExpense = z.infer<typeof extractedExpenseSchema>;
export type ExtractionOutput = z.infer<typeof extractionSchema>;

export interface InvoiceFile {
  kind: "image" | "pdf";
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export interface ExtractionContext {
  owners: ReadonlyArray<{ id: number; name: string }>;
  fleet: ReadonlyArray<{ id: number; plate: string }>;
  /** Pages of a PDF; null for a photo. */
  pageCount: number | null;
}

export interface InvoiceExtractor {
  extract(file: InvoiceFile, context: ExtractionContext): Promise<ExtractionOutput>;
}

/** The AI is not set up (no API key): the user is told, nothing is logged as a failure. */
export class ExtractorNotConfiguredError extends Error {}

/** The model failed, refused or answered something unusable. */
export class ExtractionFailedError extends Error {}

export const EXTRACTION_PROMPT = `Eres un asistente de contabilidad para una empresa de transporte en Colombia. Lees fotos y PDF de facturas, recibos y soportes de una caja y devuelves un gasto por cada factura o recibo.

Reglas:
- Un gasto por factura o recibo. Una factura puede ocupar varias hojas del PDF y una hoja puede traer varias facturas pequeñas. En "pages" pon las hojas (empezando en 1) donde está cada factura; en una foto usa [1].
- Los soportes son variados: facturas electrónicas impresas, talonarios escritos a mano, pólizas de SOAT, guías de mensajería, tiquetes de peaje o combustible.
- "detail": descripción corta de la compra o servicio (por ejemplo "Filtro de aceite", "SOAT", "Envío de documentos").
- "supplierNit" y "supplierName": el NIT y el nombre de quien EMITE la factura (el proveedor). Escribe el NIT solo con dígitos y SIN el dígito de verificación (el que va después del guion, por ejemplo 900123456-7 se escribe 900123456).
- "billedTo": a quién se le factura, el campo "Señor(es)", "Cliente", "Adquiriente" o "Tomador". La empresa SIEMPRE debe ser uno de los propietarios de la lista: pon su "ownerId" y su nombre exacto de la lista. La letra a mano puede estar mal escrita ("Fabion Pae7" es FABIAN PAEZ): usa la lista para acertar. Si no corresponde claramente a ninguno, pon "ownerId": null; nunca inventes una empresa que no esté en la lista.
- "vehiclePlate": la placa o código del vehículo si aparece (a mano o impresa). Si coincide con un vehículo de la lista, pon su "vehicleId" ("TRNO84" es TRN-084). Si no hay vehículo, null.
- "isElectronicInvoice": true solo si es una factura electrónica (tiene CUFE, código QR de la DIAN o dice "factura electrónica de venta").
- "value": el total a pagar en pesos colombianos como número entero. El punto es separador de miles ("45.000" es 45000, "1.250.000" es 1250000).
- Lo que no puedas leer con seguridad es null; nunca inventes datos.
- "unreadablePages": hojas del PDF (empezando en 1) que tienen una factura pero no se puede leer. Una hoja en blanco o sin facturas no se lista.
- Si el archivo no tiene facturas, devuelve "expenses" vacío.`;

/** The lists the model matches handwriting against, as the user turn of the request. */
export function buildContextText(context: ExtractionContext): string {
  const owners = context.owners.map((o) => `${o.id}: ${o.name}`).join("\n") || "(ninguno)";
  const fleet = context.fleet.map((v) => `${v.id}: ${v.plate}`).join("\n") || "(ninguno)";
  const pages = context.pageCount === null ? "Es una foto de una sola hoja." : `El PDF tiene ${context.pageCount} hojas.`;
  return `${pages}\n\nPropietarios (id: nombre):\n${owners}\n\nVehículos de la flota (id: placa):\n${fleet}\n\nExtrae los gastos del archivo.`;
}
