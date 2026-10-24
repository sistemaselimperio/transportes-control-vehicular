import { todayInBogota, type IsoDate } from "@/modules/shared/domain/dates";
import { loadVehicleFormLists } from "@/modules/vehicles/infrastructure/vehicle-repository";
import {
  summarizeCost,
  summarizeFuel,
  type FuelRow,
  type LogbookQuery,
  type LogbookTab,
  type OilRow,
  type ServiceRow,
  type TireRow,
} from "../domain/logbook";
import {
  loadFuelRows,
  loadOilRows,
  loadProviders,
  loadServiceRows,
  loadTireRows,
} from "../infrastructure/logbook-repository";

/** The rows of the active tab, with the totals of what is filtered. */
export type LogbookData =
  | { tab: "servicios"; rows: ServiceRow[]; summary: ReturnType<typeof summarizeCost> }
  | { tab: "aceite"; rows: OilRow[]; summary: ReturnType<typeof summarizeCost> }
  | { tab: "llantas"; rows: TireRow[]; summary: ReturnType<typeof summarizeCost> }
  | { tab: "combustible"; rows: FuelRow[]; summary: ReturnType<typeof summarizeFuel> };

export interface LogbookPage {
  data: LogbookData;
  /** Providers already used, for the forms' suggestions. */
  providers: string[];
  /** Plates that can still receive records (not sold). */
  plates: string[];
  today: IsoDate;
}

async function loadData(tab: LogbookTab, query: LogbookQuery): Promise<LogbookData> {
  switch (tab) {
    case "servicios": {
      const rows = await loadServiceRows(query);
      return { tab, rows, summary: summarizeCost(rows) };
    }
    case "aceite": {
      const rows = await loadOilRows(query);
      return { tab, rows, summary: summarizeCost(rows) };
    }
    case "llantas": {
      const rows = await loadTireRows(query);
      return { tab, rows, summary: summarizeCost(rows) };
    }
    case "combustible": {
      const rows = await loadFuelRows(query);
      return { tab, rows, summary: summarizeFuel(rows) };
    }
  }
}

export async function getLogbookPage(tab: LogbookTab, query: LogbookQuery): Promise<LogbookPage> {
  const [data, providers, lists] = await Promise.all([loadData(tab, query), loadProviders(), loadVehicleFormLists()]);
  return { data, providers, plates: lists.plates, today: todayInBogota() };
}
