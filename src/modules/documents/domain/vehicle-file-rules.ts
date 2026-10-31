/**
 * Business rules for the files (PDF / images) attached to a vehicle: which
 * categories exist and what can be uploaded. A category holds any number of files.
 */
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";

export type FileCategory = "POLICY" | "SOAT" | "TECNO" | "TAX" | "LOGBOOK" | "OWNERSHIP_CARD";

export const FILE_CATEGORIES: Record<FileCategory, { label: string }> = {
  POLICY: { label: "Póliza" },
  SOAT: { label: "SOAT" },
  TECNO: { label: "Tecnomecánica" },
  TAX: { label: "Impuestos" },
  LOGBOOK: { label: "Bitácoras" },
  OWNERSHIP_CARD: { label: "Tarjeta de propiedad" },
};

export const FILE_CATEGORY_KEYS = Object.keys(FILE_CATEGORIES) as FileCategory[];

export const isFileCategory = (value: string): value is FileCategory => value in FILE_CATEGORIES;

export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

/** Vercel caps a request body at 4.5 MB, so one file must stay below that. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

export function assertCanUpload(input: {
  category: FileCategory;
  mimeType: string;
  size: number;
}): void {
  if (!(ALLOWED_MIME as readonly string[]).includes(input.mimeType)) {
    throw new RuleError("Solo se permiten archivos PDF, JPG, PNG o WebP.");
  }
  if (input.size <= 0) throw new RuleError("El archivo está vacío.");
  if (input.size > MAX_FILE_BYTES) {
    throw new RuleError("El archivo supera el límite de 4 MB.");
  }
}

/** "512 B", "250 KB", "1,5 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
