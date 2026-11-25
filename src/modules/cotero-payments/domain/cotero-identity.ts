/**
 * Who a cotero is. Coteros are free text, so the same person can be written in several ways: the
 * cédula, when present, identifies them (handwriting distorts names, not numbers); otherwise the name
 * without case, accents, spaces or punctuation does.
 */
import { collapseWhitespace, searchKey } from "@/modules/shared/domain/search-key";

/** Trimmed, single-spaced name, casing kept: how it is shown and stored. */
export const canonicalName = collapseWhitespace;

/** The digits of a cédula or NIT, or null when blank or not between 5 and 12 digits. */
export function normalizeDocument(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 5 && digits.length <= 12 ? digits : null;
}

/** Grouping key of a cotero: `doc:<digits>` with a cédula, else `name:<search key>`; null with neither. */
export function coteroKey(input: { name: string; document: string | null | undefined }): string | null {
  const document = normalizeDocument(input.document);
  if (document !== null) return `doc:${document}`;
  const name = searchKey(input.name);
  return name === "" ? null : `name:${name}`;
}

export interface CoteroGroupItem {
  coteroKey: string;
  coteroName: string;
  coteroDocument: string | null;
  date: string;
}

export interface CoteroGroup<T extends CoteroGroupItem> {
  key: string;
  /** The name of the most recent receipt. */
  name: string;
  /** The cédula of the most recent receipt that has one. */
  document: string | null;
  items: T[];
}

/** Receipts grouped by cotero, groups sorted by name. */
export function groupByCotero<T extends CoteroGroupItem>(items: readonly T[]): CoteroGroup<T>[] {
  const byKey = new Map<string, T[]>();
  for (const item of items) byKey.set(item.coteroKey, [...(byKey.get(item.coteroKey) ?? []), item]);
  const groups = [...byKey.entries()].map(([key, group]) => {
    const newestFirst = [...group].sort((a, b) => b.date.localeCompare(a.date));
    return {
      key,
      name: newestFirst[0].coteroName,
      document: newestFirst.find((i) => i.coteroDocument !== null)?.coteroDocument ?? null,
      items: group,
    };
  });
  return groups.sort((a, b) => a.name.localeCompare(b.name, "es"));
}
