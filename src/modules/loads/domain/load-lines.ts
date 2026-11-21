import { bagsToKg, kgToTons } from "@/modules/orders/domain/order-rules";
import { parseDecimal } from "@/modules/shared/domain/decimal";
import { searchKey } from "@/modules/shared/domain/search-key";

/** One product of a load, with its own cost, SIESA number and supplier order number. */
export interface LoadLineRow {
  id: number;
  /** Null only for lines migrated from the single-product loads: they must get a product when edited. */
  referenceId: number | null;
  referenceName: string | null;
  tons: number;
  /** Whole pesos (COP). */
  cost: number;
  /** Unique across the lines of every load. */
  siesaNumber: string;
  /** The supplier's order number. */
  orderNumber: string;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000 + 0;

/** Tons and cost of a load: the sum of its lines. */
export function loadTotals(lines: ReadonlyArray<{ tons: number; cost: number }>): { tons: number; cost: number } {
  return {
    tons: round3(lines.reduce((sum, l) => sum + l.tons, 0)),
    cost: lines.reduce((sum, l) => sum + l.cost, 0),
  };
}

/** The first value that appears twice (blanks ignored), or null. */
export function firstDuplicate(values: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const v of values) {
    if (v === "") continue;
    if (seen.has(v)) return v;
    seen.add(v);
  }
  return null;
}

/** What the checked orders ask for of one product. */
export interface SuggestedLine {
  referenceName: string;
  tons: number;
}

/** One suggestion per reference across the orders (first spelling wins), tons = bags x kg per bag / 1000. */
export function suggestLines(
  orders: ReadonlyArray<{ lines: ReadonlyArray<{ referenceName: string; bags: number }> }>,
  kgPerBag: number,
): SuggestedLine[] {
  const bagsByKey = new Map<string, { referenceName: string; bags: number }>();
  for (const order of orders) {
    for (const l of order.lines) {
      const key = searchKey(l.referenceName);
      const known = bagsByKey.get(key);
      if (known) known.bags += l.bags;
      else bagsByKey.set(key, { referenceName: l.referenceName, bags: l.bags });
    }
  }
  return [...bagsByKey.values()].map((s) => ({ referenceName: s.referenceName, tons: round3(kgToTons(bagsToKg(s.bags, kgPerBag))) }));
}

/** A product line while the form is being filled: everything is text until it is sent. */
export interface LineDraft {
  key: number;
  reference: string;
  tons: string;
  cost: string;
  siesaNumber: string;
  orderNumber: string;
  /** Suggested from the checked orders and not touched since: it follows them. */
  auto: boolean;
  /** Stored without a product (migrated): it must get one before the load can be saved. */
  legacy?: boolean;
}

const tonsText = (tons: number): string => String(round3(tons));

/**
 * The drafts after the checked orders changed. A reference that stays keeps what the user entered
 * (an untouched suggestion only follows the new tons); new references get a suggested line; a
 * suggested line the user never touched disappears with its reference. Manual lines always stay.
 */
export function reconcileDrafts(drafts: readonly LineDraft[], suggestions: readonly SuggestedLine[], nextKey: number): LineDraft[] {
  const byKey = new Map(suggestions.map((s) => [searchKey(s.referenceName), s]));
  const present = new Set<string>();
  const kept: LineDraft[] = [];
  for (const d of drafts) {
    const key = searchKey(d.reference);
    const suggestion = byKey.get(key);
    if (d.auto && !suggestion) continue;
    if (suggestion) present.add(key);
    kept.push(d.auto && suggestion ? { ...d, tons: tonsText(suggestion.tons) } : d);
  }
  let key = nextKey;
  for (const s of suggestions) {
    if (present.has(searchKey(s.referenceName))) continue;
    kept.push({ key: key++, reference: s.referenceName, tons: tonsText(s.tons), cost: "", siesaNumber: "", orderNumber: "", auto: true });
  }
  return kept;
}

export interface OrderedVersusLoaded {
  referenceName: string;
  ordered: number;
  loaded: number;
  /** Loaded minus ordered, rounded to the kilo. */
  difference: number;
}

/** Per ordered product, the tons asked for by the orders against the tons typed on the lines. */
export function orderedVersusLoaded(
  drafts: ReadonlyArray<Pick<LineDraft, "reference" | "tons">>,
  suggestions: readonly SuggestedLine[],
): OrderedVersusLoaded[] {
  return suggestions.map((s) => {
    const key = searchKey(s.referenceName);
    const loaded = round3(
      drafts.filter((d) => searchKey(d.reference) === key).reduce((sum, d) => sum + (parseDecimal(d.tons) ?? 0), 0),
    );
    return { referenceName: s.referenceName, ordered: s.tons, loaded, difference: round3(loaded - s.tons) };
  });
}
