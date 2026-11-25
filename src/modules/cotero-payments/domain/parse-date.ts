const isRealDate = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * A date as written on the paper, day first ("11/11/2026", "5-12-26", "5.12.2026"), as an ISO day.
 * A two digit year is in the 2000s. Empty text when it is not a real date.
 */
export function parseColombianDate(raw: string): string {
  const text = raw.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoMatch) {
    const [y, m, d] = [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])];
    return isRealDate(y, m, d) ? iso(y, m, d) : "";
  }
  const match = /^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2}|\d{4})$/.exec(text);
  if (!match) return "";
  const d = Number(match[1]);
  const m = Number(match[2]);
  const y = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  return isRealDate(y, m, d) ? iso(y, m, d) : "";
}
