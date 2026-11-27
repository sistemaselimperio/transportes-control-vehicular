import type { IsoDate } from "@/modules/shared/domain/dates";

export const BOX_STATUSES = ["open", "closed"] as const;
export type BoxStatus = (typeof BOX_STATUSES)[number];

export const BOX_STATUS_LABELS: Record<BoxStatus, string> = { open: "Abierta", closed: "Cerrada" };

/** A refusal whose message is meant for the user. */
export class DailyCashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailyCashError";
  }
}

export interface BoxKey {
  id: number;
  date: IsoDate;
  status: BoxStatus;
}

/** Chronological order. The date is unique per user, so it alone orders the boxes. */
const byDate = (a: Pick<BoxKey, "date">, b: Pick<BoxKey, "date">) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** The box right before `id` by date; null for the earliest one (or an unknown id). */
export function previousBox<T extends BoxKey>(boxes: readonly T[], id: number): T | null {
  const sorted = [...boxes].sort(byDate);
  const index = sorted.findIndex((b) => b.id === id);
  return index > 0 ? sorted[index - 1] : null;
}

/** A box closes only once the one before it is closed (or when it is the earliest). */
export function canCloseBox(boxes: readonly BoxKey[], id: number): boolean {
  const previous = previousBox(boxes, id);
  return previous === null || previous.status === "closed";
}

/**
 * Whether a box with this date would be the earliest of the user's boxes: the only one whose
 * opening balance is typed by hand. `others` are the user's other boxes.
 */
export function isFirstBox(others: ReadonlyArray<Pick<BoxKey, "date">>, date: IsoDate): boolean {
  return others.every((b) => date < b.date);
}

/** Only an open box takes changes. */
export function assertBoxOpen(status: BoxStatus): void {
  if (status === "closed") throw new DailyCashError("La caja está cerrada. Ábrela de nuevo para modificarla.");
}
