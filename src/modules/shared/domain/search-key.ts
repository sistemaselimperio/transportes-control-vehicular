/** Lowercase, without accents, spaces or punctuation: "Córdoba" and "cordoba" compare equal. */
export function searchKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]/g, "");
}

/** True when every word of `query` is found in some of the `fields`; a blank query matches everything. */
export function matchesQuery(fields: ReadonlyArray<string | null | undefined>, query: string): boolean {
  const words = query.split(/\s+/).map(searchKey).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields.filter((f): f is string => Boolean(f)).map(searchKey);
  return words.every((word) => haystack.some((field) => field.includes(word)));
}
