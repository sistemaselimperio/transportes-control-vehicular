import { productLabel } from "@/modules/orders/domain/catalog";
import { bagsToKg, kgToTons } from "@/modules/orders/domain/order-rules";
import { parseDecimal } from "@/modules/shared/domain/decimal";

/** One product of a load, with its own cost, SIESA number and supplier order number. */
export interface LoadLineRow {
  id: number;
  /** Null only for lines migrated from the single-product loads: they must get a product when edited. */
  referenceId: number | null;
  referenceName: string | null;
  /** Null for lines without a product and for products typed inline before the catalog existed. */
  referenceCode: string | null;
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
  referenceId: number;
  referenceName: string;
  referenceCode: string | null;
  tons: number;
}

interface OrderedProduct {
  referenceId: number;
  referenceName: string;
  referenceCode: string | null;
  bags: number;
}

/** One suggestion per product across the orders, tons = bags x kg per bag / 1000. */
export function suggestLines(orders: ReadonlyArray<{ lines: readonly OrderedProduct[] }>, kgPerBag: number): SuggestedLine[] {
  const byId = new Map<number, OrderedProduct>();
  for (const order of orders) {
    for (const l of order.lines) {
      const known = byId.get(l.referenceId);
      if (known) known.bags += l.bags;
      else byId.set(l.referenceId, { referenceId: l.referenceId, referenceName: l.referenceName, referenceCode: l.referenceCode, bags: l.bags });
    }
  }
  return [...byId.values()].map(({ bags, ...product }) => ({ ...product, tons: round3(kgToTons(bagsToKg(bags, kgPerBag))) }));
}

/** A product line while the form is being filled: everything is text until it is sent. */
export interface LineDraft {
  key: number;
  /** The catalog product, or null while none is chosen. */
  referenceId: number | null;
  /** The product as last known ("code · name"); what a stored product outside the catalog shows. */
  reference: string;
  tons: string;
  cost: string;
  siesaNumber: string;
  orderNumber: string;
  /** Suggested from the checked orders and not touched since: it follows them. */
  auto: boolean;
}

const tonsText = (tons: number): string => String(round3(tons));

/**
 * The drafts after the checked orders changed. A product that stays keeps what the user entered
 * (an untouched suggestion only follows the new tons); new products get a suggested line; a
 * suggested line the user never touched disappears with its product. Manual lines always stay.
 */
export function reconcileDrafts(drafts: readonly LineDraft[], suggestions: readonly SuggestedLine[], nextKey: number): LineDraft[] {
  const byId = new Map(suggestions.map((s) => [s.referenceId, s]));
  const present = new Set<number>();
  const kept: LineDraft[] = [];
  for (const d of drafts) {
    const suggestion = d.referenceId === null ? undefined : byId.get(d.referenceId);
    if (d.auto && !suggestion) continue;
    if (suggestion) present.add(suggestion.referenceId);
    kept.push(d.auto && suggestion ? { ...d, tons: tonsText(suggestion.tons) } : d);
  }
  let key = nextKey;
  for (const s of suggestions) {
    if (present.has(s.referenceId)) continue;
    kept.push({
      key: key++,
      referenceId: s.referenceId,
      reference: productLabel({ code: s.referenceCode, name: s.referenceName }),
      tons: tonsText(s.tons),
      cost: "",
      siesaNumber: "",
      orderNumber: "",
      auto: true,
    });
  }
  return kept;
}

export interface OrderedVersusLoaded {
  referenceId: number;
  /** "code · name" of the product. */
  label: string;
  ordered: number;
  loaded: number;
  /** Loaded minus ordered, rounded to the kilo. */
  difference: number;
}

/** Per ordered product, the tons asked for by the orders against the tons typed on the lines. */
export function orderedVersusLoaded(
  drafts: ReadonlyArray<Pick<LineDraft, "referenceId" | "tons">>,
  suggestions: readonly SuggestedLine[],
): OrderedVersusLoaded[] {
  return suggestions.map((s) => {
    const loaded = round3(drafts.filter((d) => d.referenceId === s.referenceId).reduce((sum, d) => sum + (parseDecimal(d.tons) ?? 0), 0));
    return {
      referenceId: s.referenceId,
      label: productLabel({ code: s.referenceCode, name: s.referenceName }),
      ordered: s.tons,
      loaded,
      difference: round3(loaded - s.tons),
    };
  });
}

/** The whole pesos typed in a cost field ("1.500.000" -> 1500000); 0 when there are no digits. */
export const costOf = (text: string): number => Number(text.replace(/\D/g, "")) || 0;

/** A line the server would accept: product, tons > 0, cost > 0, SIESA and supplier order filled. */
export function isDraftComplete(d: Pick<LineDraft, "referenceId" | "tons" | "cost" | "siesaNumber" | "orderNumber">): boolean {
  return (
    d.referenceId !== null &&
    (parseDecimal(d.tons) ?? 0) > 0 &&
    costOf(d.cost) > 0 &&
    d.siesaNumber.trim() !== "" &&
    d.orderNumber.trim() !== ""
  );
}

/** What the form shows above the lines: how many, and the tons and pesos typed so far. */
export function draftsTotals(drafts: ReadonlyArray<Pick<LineDraft, "tons" | "cost">>): { count: number; tons: number; cost: number } {
  return {
    count: drafts.length,
    tons: round3(drafts.reduce((sum, d) => sum + (parseDecimal(d.tons) ?? 0), 0)),
    cost: drafts.reduce((sum, d) => sum + costOf(d.cost), 0),
  };
}
