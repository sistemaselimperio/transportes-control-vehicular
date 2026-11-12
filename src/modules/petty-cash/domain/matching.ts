/** Text comparison for names typed by hand or read from handwriting: no case, accents or extra spaces. */
export function normalizeText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The owner whose name equals `text` (ignoring case and accents), or null. */
export function matchOwner<T extends { name: string }>(text: string | null, owners: readonly T[]): T | null {
  const wanted = normalizeText(text ?? "");
  if (wanted === "") return null;
  return owners.find((o) => normalizeText(o.name) === wanted) ?? null;
}

/** Shorter names would match almost anything. */
const MIN_NAME_LENGTH = 4;

/**
 * The NIT of the catalog supplier whose name contains `name` (or is contained in it), ignoring case
 * and accents. Null when nothing or more than one supplier matches: guessing would mislabel an expense.
 */
export function findSupplierNitByName(
  name: string | null,
  suppliers: ReadonlyArray<{ nit: string; supplierName: string | null }>,
): string | null {
  const wanted = normalizeText(name ?? "");
  if (wanted.length < MIN_NAME_LENGTH) return null;
  const nits = new Set<string>();
  for (const s of suppliers) {
    const known = normalizeText(s.supplierName ?? "");
    if (known.length < MIN_NAME_LENGTH) continue;
    if (known.includes(wanted) || wanted.includes(known)) nits.add(s.nit);
  }
  return nits.size === 1 ? [...nits][0] : null;
}
