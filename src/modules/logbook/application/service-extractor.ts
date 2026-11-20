/**
 * Port that reads the maintenance records of a photo or PDF (a handwritten or printed maintenance
 * log, or a list) with an AI model behind it, with the shape of its answer and the prompt. The
 * model fills every field; what it cannot read is null.
 */
import { z } from "zod";

export const extractedServiceSchema = z.object({
  /** Date of the service as an ISO calendar date (YYYY-MM-DD). */
  date: z.string().nullable(),
  /** A plate of the fleet list given in the prompt, exactly as listed. */
  plate: z.string().nullable(),
  kind: z.enum(["PREVENTIVE", "CORRECTIVE"]).nullable(),
  /** What was done or replaced, as written. */
  description: z.string(),
  provider: z.string().nullable(),
  /** Odometer in whole kilometers. */
  km: z.number().int().nullable(),
  /** Cost in whole Colombian pesos. */
  price: z.number().int().nullable(),
  notes: z.string().nullable(),
});

export const serviceExtractionSchema = z.object({
  services: z.array(extractedServiceSchema),
});

export type ExtractedService = z.infer<typeof extractedServiceSchema>;
export type ServiceExtractionOutput = z.infer<typeof serviceExtractionSchema>;

export interface ServiceFile {
  kind: "image" | "pdf";
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export interface ServiceExtractionContext {
  /** Plates of the fleet the model may pick from. */
  plates: readonly string[];
  /** Providers already used in the logbook, to spell the ones it reads the same way. */
  providers: readonly string[];
  /** The plate chosen on the page, for rows that do not state a vehicle; null when none. */
  defaultPlate: string | null;
  /** Today in Bogota (ISO), so a date without a year gets the right one. */
  today: string;
}

export interface ServiceExtractor {
  extract(file: ServiceFile, context: ServiceExtractionContext): Promise<ServiceExtractionOutput>;
}

/** The AI is not set up (no API key): the user is told, nothing is logged as a failure. */
export class ServiceExtractorNotConfiguredError extends Error {}

/** The model failed, refused or answered something unusable. */
export class ServiceExtractionFailedError extends Error {}

/** Providers listed in the prompt at most; the list only helps with spelling. */
export const MAX_PROVIDERS_IN_PROMPT = 300;

export const SERVICE_EXTRACTION_PROMPT = `Eres un asistente de mantenimiento para una empresa de transporte en Colombia. Lees fotos y PDF de bitácoras de mantenimiento (escritas a mano o impresas) y de listas de mantenimientos, y devuelves un registro por cada fila o renglón.

Reglas:
- Un registro por fila o renglón de la bitácora o lista. No juntes dos filas ni partas una fila en dos. Si el archivo no tiene mantenimientos, devuelve "services" vacío.
- "date": la fecha del mantenimiento en formato ISO AAAA-MM-DD. Las fechas son colombianas: día/mes/año ("05/03/2026" es 2026-03-05, nunca 5 de mayo). Si la fila no trae el año, usa el año de hoy o el más reciente que no quede en el futuro. Si una fila no tiene fecha pero la de arriba aplica claramente (comillas o "ídem"), repítela; si no, null.
- "plate": la placa del vehículo si aparece en la fila o como encabezado de la hoja. Debe ser EXACTAMENTE una de la lista de placas ("TRN084" o "trn 084" es TRN-084). Si no aparece o no corresponde a ninguna de la lista, null; nunca inventes una placa.
- "kind": "PREVENTIVE" si es un mantenimiento programado o de rutina (cambio de filtros, engrase, revisión periódica) y "CORRECTIVE" si repara una falla o daño. Si el documento lo dice, respétalo; si no es claro, null.
- "description": lo que se hizo o se cambió, con las palabras de la fila, en una línea y sin el precio ni la fecha (por ejemplo "1 bocín, retenedor 370003, libra de grasa, mano de obra"). Si no se puede leer, escribe una cadena vacía.
- "provider": el taller, almacén o persona que hizo el trabajo o vendió el repuesto. La letra a mano puede estar mal escrita: si se parece a uno de la lista de proveedores, usa ese nombre tal cual. Si es uno nuevo, escríbelo como aparece. Si no hay, null.
- "km": el kilometraje del vehículo en la fila, como número entero. El punto es separador de miles ("359.174" es 359174). Si no hay, null.
- "price": el valor en pesos colombianos como número entero. El punto es separador de miles ("45.000" es 45000, "1.250.000" es 1250000). Si la fila no tiene valor, null.
- "notes": una novedad o comentario aparte de la descripción (por ejemplo "garantía", "pendiente cambiar"). Si no hay, null.
- Lo que no puedas leer con seguridad es null; nunca inventes datos. No incluyas encabezados, totales ni filas vacías como registros.`;

/** The lists the model matches handwriting against, as the user turn of the request. */
export function buildServiceContextText(context: ServiceExtractionContext): string {
  const plates = context.plates.join("\n") || "(ninguna)";
  const providers = context.providers.slice(0, MAX_PROVIDERS_IN_PROMPT).join("\n") || "(ninguno)";
  const fallback = context.defaultPlate
    ? `\n\nLas filas que no indiquen vehículo son de la placa ${context.defaultPlate}: ponla en "plate".`
    : "";
  return `Hoy es ${context.today}.\n\nPlacas de la flota:\n${plates}\n\nProveedores ya usados:\n${providers}${fallback}\n\nExtrae los mantenimientos del archivo.`;
}
