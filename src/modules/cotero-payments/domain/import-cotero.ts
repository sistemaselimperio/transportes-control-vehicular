/**
 * One import is one cotero: the person under review is resolved once from what the AI read (or left
 * empty for a receipt typed by hand) and forced onto every receipt of the import.
 */
import { canonicalName, normalizeDocument } from "./cotero-identity";
import { isRealIsoDate, type DraftIssue, type ReceiptDraft } from "./receipt-rules";
import type { CoteroProfileRow } from "./settlement-rows";

/** The cotero of an import as the header shows it: free text, so it can be edited. */
export interface ImportCotero {
  name: string;
  document: string;
}

export const EMPTY_IMPORT_COTERO: ImportCotero = { name: "", document: "" };

/** The stored profile of a cédula (its document, or its `doc:` key), or null. */
export function findProfileByDocument(document: string, profiles: readonly CoteroProfileRow[]): CoteroProfileRow | null {
  const digits = normalizeDocument(document);
  if (digits === null) return null;
  return profiles.find((p) => normalizeDocument(p.document) === digits || p.key === `doc:${digits}`) ?? null;
}

/**
 * Name: the first receipt's (the first non-blank one when that is blank). Cédula: the first valid one.
 * A cédula that belongs to a known cotero brings that cotero's stored name instead of the one read.
 */
export function resolveImportCotero(
  drafts: readonly ReceiptDraft[],
  profiles: readonly CoteroProfileRow[],
): ImportCotero & { known: boolean } {
  const read = drafts.map((d) => canonicalName(d.coteroName)).find((name) => name !== "") ?? "";
  const document = drafts.map((d) => normalizeDocument(d.coteroDocument)).find((d) => d !== null) ?? "";
  const profile = findProfileByDocument(document, profiles);
  return { name: profile ? profile.name : read, document, known: profile !== null };
}

/** The draft with the import's cotero written over whatever it had. */
export const applyImportCotero = (draft: ReceiptDraft, cotero: ImportCotero): ReceiptDraft => ({
  ...draft,
  coteroName: cotero.name,
  coteroDocument: cotero.document,
});

/** What is wrong with the header: a missing name or an unreadable (but written) cédula. */
export function importCoteroIssues(cotero: ImportCotero): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (canonicalName(cotero.name) === "") issues.push({ field: "coteroName", kind: "missing" });
  if (cotero.document.trim() !== "" && normalizeDocument(cotero.document) === null) issues.push({ field: "coteroDocument", kind: "invalid" });
  return issues;
}

/** Earliest and latest valid date of the drafts; null when none has one. */
export function importDateRange(drafts: readonly ReceiptDraft[]): { from: string; to: string } | null {
  const dates = drafts.map((d) => d.date.trim()).filter(isRealIsoDate).sort();
  return dates.length === 0 ? null : { from: dates[0], to: dates[dates.length - 1] };
}
