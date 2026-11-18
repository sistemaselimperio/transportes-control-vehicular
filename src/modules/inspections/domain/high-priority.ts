/**
 * "Prioridad alta": an inspection with a MAL in a mechanical section (brakes, tires, steering,
 * lights, engine, cabin), starred or not. Separate from the ★ critical flag, which alone decides
 * whether the vehicle may leave. Derived from the stored answers, so it holds for old inspections.
 */
import { PREOPERATIONAL_CHECKLIST } from "./preoperational-checklist";
import type { InspectionAnswers } from "./preoperational-inspection";

const HIGH_PRIORITY_SECTIONS = PREOPERATIONAL_CHECKLIST.filter((section) => section.highPriority);

/** Ids of the high-priority sections, in form order. */
export const HIGH_PRIORITY_SECTION_IDS: readonly string[] = HIGH_PRIORITY_SECTIONS.map((section) => section.id);

/** Ids of every item of those sections: the `answers` keys that count, also used by the list filter. */
export const HIGH_PRIORITY_ITEM_IDS: readonly string[] = HIGH_PRIORITY_SECTIONS.flatMap((section) =>
  section.items.map((item) => item.id),
);

export type HighPrioritySection = { id: string; title: string; items: string[] };

/**
 * The high-priority sections with at least one item answered MAL, once each, in form order, each
 * with the labels of its failed items (also in form order).
 */
export function highPriorityFailures(answers: InspectionAnswers): HighPrioritySection[] {
  return HIGH_PRIORITY_SECTIONS.map(({ id, title, items }) => ({
    id,
    title,
    items: items.filter((item) => answers[item.id]?.status === "MAL").map((item) => item.label),
  })).filter((section) => section.items.length > 0);
}
