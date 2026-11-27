import { matchesQuery } from "@/modules/shared/domain/search-key";
import type { ReceiptFilters } from "./receipt-rules";
import type { SettlementRow } from "./settlement-rows";

/** The settlements of the page's shared filters: dates, one exact cotero and the name / cédula search. */
export function filterSettlements(
  rows: readonly SettlementRow[],
  filters: Pick<ReceiptFilters, "from" | "to" | "coteroKey" | "search">,
): SettlementRow[] {
  return rows.filter((s) => {
    if (filters.from && s.date < filters.from) return false;
    if (filters.to && s.date > filters.to) return false;
    if (filters.coteroKey && s.coteroKey !== filters.coteroKey) return false;
    if (filters.search.trim() !== "" && !matchesQuery([s.coteroName, s.coteroDocument], filters.search)) return false;
    return true;
  });
}
