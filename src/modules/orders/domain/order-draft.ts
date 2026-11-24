/** The product rows of the order form while they are being typed: pure helpers, no React. */

export interface ProductRow {
  key: number;
  /** The catalog product, or null while none is chosen. */
  referenceId: number | null;
  /** What a stored product that is not in the catalog (legacy) is called; the picker starts with it. */
  legacyText: string;
  /** Text until the form is sent. */
  bags: string;
}

const WHOLE = /^\d{1,9}$/;

export const emptyRow = (key: number): ProductRow => ({ key, referenceId: null, legacyText: "", bags: "" });

/** A row with nothing in it: it is ignored on save. */
export const isBlankRow = (row: ProductRow): boolean => row.referenceId === null && row.legacyText === "" && row.bags.trim() === "";

/** The bags of a row: a positive whole number, or 0 while it is blank or invalid. */
export const bagsOf = (row: ProductRow): number => (WHOLE.test(row.bags.trim()) ? Number(row.bags) : 0);

/**
 * Keeps one empty row at the end to type the next product in: added when the last row has a product,
 * never past `max` rows, and always at least one row.
 */
export function withTrailingRow(rows: readonly ProductRow[], max: number): readonly ProductRow[] {
  const last = rows[rows.length - 1];
  if (last && (last.referenceId === null || rows.length >= max)) return rows;
  if (!last && max < 1) return rows;
  return [...rows, emptyRow(Math.max(-1, ...rows.map((r) => r.key)) + 1)];
}

/** The first problem of the rows (blank ones are skipped), as a message for the user; null when fine. */
export function productRowError(rows: readonly ProductRow[], inCatalog: ReadonlySet<number>): string | null {
  const filled = rows.map((row, index) => ({ row, position: index + 1 })).filter(({ row }) => !isBlankRow(row));
  for (const { row, position } of filled) {
    if (row.referenceId === null || !inCatalog.has(row.referenceId)) return `Elige la referencia del catálogo en el producto ${position}.`;
    if (bagsOf(row) === 0) return `Indica los bultos del producto ${position}.`;
  }
  return filled.length === 0 ? "Agrega al menos un producto al pedido." : null;
}

/** The JSON the server action parses; invalid bags travel as null so the schema rejects them. */
export function serializeOrder({
  clientId,
  locationId,
  rows,
}: {
  clientId: number | null;
  locationId: string;
  rows: readonly ProductRow[];
}): string {
  return JSON.stringify({
    clientId,
    locationId: locationId === "" ? null : Number(locationId),
    lines: rows
      .filter((r) => !isBlankRow(r))
      .map((r) => ({ referenceId: r.referenceId, bags: WHOLE.test(r.bags.trim()) ? Number(r.bags) : null })),
  });
}
