export interface ImportSummary {
  added: number;
  /** Read by the AI but not saved. */
  failed: number;
  unreadablePages: readonly number[];
}

/** The toast shown after an import from a photo or PDF. */
export function importMessage({ added, failed, unreadablePages }: ImportSummary): string {
  const parts = [
    added === 0
      ? "No se encontraron facturas en el archivo."
      : added === 1
        ? "Se agregó 1 gasto por revisar."
        : `Se agregaron ${added} gastos por revisar.`,
  ];
  if (unreadablePages.length > 0) {
    parts.push(
      unreadablePages.length === 1
        ? `No se pudo leer la hoja: ${unreadablePages[0]}.`
        : `No se pudieron leer las hojas: ${unreadablePages.join(", ")}.`,
    );
  }
  if (failed > 0) parts.push(failed === 1 ? "No se pudo guardar 1 gasto." : `No se pudieron guardar ${failed} gastos.`);
  return parts.join(" ");
}
