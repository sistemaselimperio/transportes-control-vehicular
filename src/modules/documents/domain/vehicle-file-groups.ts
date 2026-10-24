import type { FileCategory } from "./vehicle-file-rules";

/**
 * How the file categories are grouped on the vehicle file, in display order.
 * LOGBOOK stays in the schema but is not shown.
 */
export const FILE_GROUPS: ReadonlyArray<{ key: string; title: string; categories: readonly FileCategory[] }> = [
  { key: "expiring", title: "Vigentes con vencimiento", categories: ["SOAT", "TECNO", "POLICY", "TAX"] },
  { key: "registry", title: "Registro del vehículo", categories: ["OWNERSHIP_CARD"] },
];

/** Short type label shown next to a file, taken from its extension. */
export function fileKindLabel(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "PDF";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "Imagen";
  return "Archivo";
}
