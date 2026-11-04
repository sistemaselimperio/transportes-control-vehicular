/** Filters and paging of the internal inspections list, parsed from the page's query string. */
import type { ExitStatus } from "./exit-decision";
import { normalizePlateKey } from "./inspection-links";
import { isIsoDate } from "./preoperational-inspection";

export const INSPECTIONS_PAGE_SIZE = 25;

export type ExitFilter = "ALL" | ExitStatus;

/** The `salida` query values; `ALL` has none because it is the default. */
const EXIT_PARAMS: Record<ExitStatus, string> = { PENDING: "pendientes", APTO: "apto", NO_APTO: "no-apto" };

export const EXIT_FILTER_OPTIONS: readonly { value: ExitFilter; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "PENDING", label: "Pendientes" },
  { value: "APTO", label: "Apto" },
  { value: "NO_APTO", label: "No apto" },
];

/** The `salida` value for a filter, null for the default (no filter). */
export function exitFilterParam(exit: ExitFilter): string | null {
  return exit === "ALL" ? null : EXIT_PARAMS[exit];
}

function parseExitFilter(value: string): ExitFilter {
  const text = value.trim();
  return (Object.keys(EXIT_PARAMS) as ExitStatus[]).find((status) => EXIT_PARAMS[status] === text) ?? "ALL";
}

export type InspectionFilters = {
  /** Normalized plate fragment, empty for no filter. */
  plate: string;
  /** Inclusive YYYY-MM-DD bounds. */
  from: string | null;
  to: string | null;
  /** Registered driver / vehicle (tractor or trailer) id, null for no filter. */
  driverId: number | null;
  vehicleId: number | null;
  /** Exit decision filter: `ALL` for no filter. */
  exit: ExitFilter;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

const parseDate = (value: string) => (isIsoDate(value.trim()) ? value.trim() : null);

/** A positive whole id that fits a Postgres integer, else null. */
const parseId = (value: string) => {
  const text = value.trim();
  const id = /^\d{1,9}$/.test(text) ? Number(text) : 0;
  return id >= 1 ? id : null;
};

export function parseInspectionFilters(params: Params): InspectionFilters {
  // Without the hyphen: the list compares it against the stored plate with its hyphen removed.
  const plate = normalizePlateKey(first(params.placa)).slice(0, 15);
  let from = parseDate(first(params.desde));
  let to = parseDate(first(params.hasta));
  if (from && to && from > to) [from, to] = [to, from];

  const pageText = first(params.pagina).trim();
  const page = /^\d{1,6}$/.test(pageText) ? Number(pageText) : 1;

  return {
    plate,
    from,
    to,
    driverId: parseId(first(params.conductor)),
    vehicleId: parseId(first(params.vehiculo)),
    exit: parseExitFilter(first(params.salida)),
    page: page >= 1 ? page : 1,
  };
}

export { escapeLikePattern } from "@/modules/shared/domain/like-pattern";
