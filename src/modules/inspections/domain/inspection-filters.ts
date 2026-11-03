/** Filters and paging of the internal inspections list, parsed from the page's query string. */
import { isIsoDate, normalizeInspectionPlate } from "./preoperational-inspection";

export const INSPECTIONS_PAGE_SIZE = 25;

export type InspectionFilters = {
  /** Normalized plate fragment, empty for no filter. */
  plate: string;
  /** Inclusive YYYY-MM-DD bounds. */
  from: string | null;
  to: string | null;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

const parseDate = (value: string) => (isIsoDate(value.trim()) ? value.trim() : null);

export function parseInspectionFilters(params: Params): InspectionFilters {
  const plate = normalizeInspectionPlate(first(params.placa)).slice(0, 15);
  let from = parseDate(first(params.desde));
  let to = parseDate(first(params.hasta));
  if (from && to && from > to) [from, to] = [to, from];

  const pageText = first(params.pagina).trim();
  const page = /^\d{1,6}$/.test(pageText) ? Number(pageText) : 1;

  return { plate, from, to, page: page >= 1 ? page : 1 };
}

export { escapeLikePattern } from "@/modules/shared/domain/like-pattern";
