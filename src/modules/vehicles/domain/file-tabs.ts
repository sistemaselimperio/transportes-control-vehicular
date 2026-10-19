/** Tabs of the vehicle file (`?tab=`). */
export type FileTab = "resumen" | "documentos" | "mantenimiento" | "personas" | "historial";

export const FILE_TABS: ReadonlyArray<{ key: FileTab; label: string }> = [
  { key: "resumen", label: "Resumen" },
  { key: "documentos", label: "Documentos" },
  { key: "mantenimiento", label: "Mantenimiento" },
  { key: "personas", label: "Personas" },
  { key: "historial", label: "Historial" },
];

export const DEFAULT_TAB: FileTab = "resumen";

export function parseTabParam(value: string | string[] | undefined): FileTab {
  const v = Array.isArray(value) ? value[0] : value;
  return FILE_TABS.find((t) => t.key === v)?.key ?? DEFAULT_TAB;
}
