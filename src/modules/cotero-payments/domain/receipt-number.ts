/**
 * The consecutive number printed on a cash receipt ("T 0248", "T 428"): up to three letters and the
 * digits, written "T-0248". The digits are kept exactly as written, so "T-0428" and "T-428" stay apart.
 * `null` when the text is not a receipt number (no digits, more than one group of digits, too long).
 */
export function normalizeReceiptNumber(raw: string): string | null {
  const text = raw.trim().toUpperCase();
  const match = /^([A-Z]{0,3})[\s-]*(\d{1,10})$/.exec(text);
  if (!match) return null;
  const [, letters, digits] = match;
  return letters === "" ? digits : `${letters}-${digits}`;
}
