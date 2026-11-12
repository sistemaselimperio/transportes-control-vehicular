/** The URL segment of a ledger: the user's own consecutive number, e.g. `planilla-12`. */
export const ledgerSlug = (number: number) => `planilla-${number}`;

export type LedgerParam = { kind: "number"; number: number } | { kind: "legacyId"; id: number };

// A positive integer without leading zeros that still fits a Postgres integer column.
const SLUG = /^planilla-([1-9]\d{0,8})$/i;
const LEGACY = /^([1-9]\d{0,8})$/;

/**
 * Reads the route segment of a ledger. Plain digits are the old URLs that carried the database id;
 * zero, leading zeros, signs and anything else are rejected.
 */
export function parseLedgerParam(param: string): LedgerParam | null {
  const slug = SLUG.exec(param);
  if (slug) return { kind: "number", number: Number(slug[1]) };
  const legacy = LEGACY.exec(param);
  if (legacy) return { kind: "legacyId", id: Number(legacy[1]) };
  return null;
}
