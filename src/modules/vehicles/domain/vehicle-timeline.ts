/**
 * The combined, read-only history of a vehicle: every owner, driver, document
 * and oil-change event on one timeline, newest first.
 */
import type { IsoDate } from "@/modules/shared/domain/dates";

export type TimelineKind = "owner" | "driver" | "document" | "oil" | "sale";

export interface TimelineEntry {
  kind: TimelineKind;
  /** When it happened; null when the record carries no date. */
  date: IsoDate | null;
  title: string;
  detail: string;
}

/**
 * Newest first. Entries on the same day keep their incoming order (the sort is
 * stable); undated entries go last, also in incoming order.
 */
export function mergeTimeline(entries: readonly TimelineEntry[]): TimelineEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (a.entry.date !== b.entry.date) {
        if (a.entry.date === null) return 1;
        if (b.entry.date === null) return -1;
        return a.entry.date < b.entry.date ? 1 : -1;
      }
      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}
