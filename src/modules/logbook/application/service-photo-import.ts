/**
 * Import of maintenance records from a photo or PDF: an AI reads the file and every row becomes an
 * editable draft (form-shaped strings) that the person reviews; nothing is written here. Saving goes
 * through `saveServiceRows`, which runs each draft through the same schema and command as the
 * single-record form, so one bad row never loses the others.
 */
import { ZodError } from "zod";
import { sniffFileKind } from "@/modules/petty-cash/domain/file-kind";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { normalizePlateQuery, type ServiceKind } from "../domain/logbook";
import type { LogbookCommands } from "./logbook-commands";
import { serviceSchema } from "./logbook-schemas";
import {
  ServiceExtractorNotConfiguredError,
  type ExtractedService,
  type ServiceExtractor,
  type ServiceFile,
} from "./service-extractor";

/** The file travels in a server-action body, whose limit is 4.5 MB (next.config.ts). */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
/** Rows kept from one file and saved in one go. */
export const MAX_DRAFTS = 100;

/** One extracted row as the review form edits it: every field is the text of its input. */
export interface ServiceDraft {
  plate: string;
  date: string;
  kind: ServiceKind;
  description: string;
  provider: string;
  km: string;
  price: string;
  notes: string;
}

export interface DraftContext {
  plates: readonly string[];
  providers: readonly string[];
  defaultPlate: string | null;
}

const clean = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const wholeNumber = (value: number | null, min: number) =>
  value !== null && Number.isInteger(value) && value >= min ? String(value) : "";

/** The listed plate a text names, without case, spaces or dashes; "" when none matches. */
function resolvePlate(text: string | null, plates: readonly string[]): string {
  const key = normalizePlateQuery(text ?? "");
  return key ? (plates.find((p) => normalizePlateQuery(p) === key) ?? "") : "";
}

/** Every field the model could not read stays empty for the reviewer; invented plates are dropped. */
export function toDrafts(items: readonly ExtractedService[], context: DraftContext): ServiceDraft[] {
  const fallback = resolvePlate(context.defaultPlate, context.plates);
  const known = new Map(context.providers.map((p) => [fold(p), p]));
  return items
    .filter((item) => clean(item.description) !== "" || item.price !== null || clean(item.provider) !== "")
    .slice(0, MAX_DRAFTS)
    .map((item) => {
      const provider = clean(item.provider);
      const date = clean(item.date);
      return {
        plate: resolvePlate(item.plate, context.plates) || fallback,
        date: isIsoDate(date) ? date : "",
        // The single-record form starts on "Correctivo" too; the reviewer changes the ones that were not.
        kind: item.kind ?? "CORRECTIVE",
        description: clean(item.description).slice(0, 500),
        provider: (known.get(fold(provider)) ?? provider).slice(0, 120),
        km: wholeNumber(item.km, 0),
        price: wholeNumber(item.price, 1),
        notes: clean(item.notes).slice(0, 500),
      };
    });
}

export interface ServicePhotoPorts {
  extractor: ServiceExtractor;
  loadPlates(): Promise<string[]>;
  loadProviders(): Promise<string[]>;
  today(): string;
}

export function createServicePhotoImport(ports: ServicePhotoPorts) {
  return {
    /** Reads the file and returns its rows as drafts, matched against the fleet plates and known providers. */
    async read(upload: { fileName: string; data: Buffer }, defaultPlate: string | null): Promise<ServiceDraft[]> {
      if (upload.data.length === 0) throw new RuleError("Elige una foto o un PDF.");
      if (upload.data.length > MAX_PHOTO_BYTES) throw new RuleError("El archivo supera el límite de 4 MB.");
      const type = sniffFileKind(upload.data);
      if (!type) throw new RuleError("Sube una foto JPG, PNG o WebP, o un PDF.");

      const [plates, providers] = await Promise.all([ports.loadPlates(), ports.loadProviders()]);
      const file: ServiceFile = { kind: type.kind, fileName: upload.fileName, mimeType: type.mimeType, data: upload.data };
      const fallback = resolvePlate(defaultPlate, plates) || null;
      let output;
      try {
        output = await ports.extractor.extract(file, { plates, providers, defaultPlate: fallback, today: ports.today() });
      } catch (e) {
        if (e instanceof ServiceExtractorNotConfiguredError) throw new RuleError("La extracción con IA no está configurada.");
        console.error("service extraction failed", e);
        throw new RuleError("No se pudo leer el archivo con IA. Intenta de nuevo.");
      }
      return toDrafts(output.services, { plates, providers, defaultPlate: fallback });
    },
  };
}

export type ServiceRowError = { index: number; error: string };

export interface SaveRowsResult {
  saved: number;
  errors: ServiceRowError[];
}

/** Saves every draft with the single-record rules; the failures are reported by position, the rest are kept. */
export async function saveServiceRows(
  commands: Pick<LogbookCommands, "create">,
  rows: readonly Record<string, string>[],
): Promise<SaveRowsResult> {
  if (rows.length === 0) throw new RuleError("No hay mantenimientos para guardar.");
  if (rows.length > MAX_DRAFTS) throw new RuleError(`Puedes guardar hasta ${MAX_DRAFTS} mantenimientos a la vez.`);
  const errors: ServiceRowError[] = [];
  let saved = 0;
  for (const [index, row] of rows.entries()) {
    try {
      const { plate, ...values } = serviceSchema.parse(row);
      await commands.create("service", plate, values);
      saved++;
    } catch (e) {
      if (e instanceof RuleError) errors.push({ index, error: e.message });
      else if (e instanceof ZodError) errors.push({ index, error: e.issues[0]?.message ?? "Revisa los datos ingresados." });
      else {
        console.error("logbook photo import row failed", e);
        errors.push({ index, error: "No se pudo guardar. Intenta de nuevo." });
      }
    }
  }
  return { saved, errors };
}
