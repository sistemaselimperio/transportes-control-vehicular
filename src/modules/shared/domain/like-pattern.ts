/** Escapes `%`, `_` and `\` so user text is matched literally by `LIKE`/`ILIKE`. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
