import { cacheLife, cacheTag } from "next/cache";
import { readTags } from "@/lib/cache-tags";
import { currentDay } from "@/lib/current-day";
import type { IsoDate } from "@/modules/shared/domain/dates";
import { loadVehicleFormLists } from "@/modules/vehicles/infrastructure/vehicle-repository";
import {
  normalizePlateQuery,
  type CostSummary,
  type FuelRow,
  type FuelSummary,
  type LogbookQuery,
  type LogbookTab,
  type OilRow,
  type ServiceRow,
  type TireRow,
} from "../domain/logbook";
import {
  findVehicleIdByPlate,
  loadDriversOfVehicle,
  loadFuelPage,
  loadOilPage,
  loadProviders,
  loadServicePage,
  loadTirePage,
  summarizeFuelFills,
  summarizeOil,
  summarizeServices,
  summarizeTires,
  type LogbookScope,
} from "../infrastructure/logbook-repository";

/** The totals of the active tab. */
export type TabSummary =
  | { tab: "servicios" | "aceite" | "llantas"; summary: CostSummary }
  | { tab: "combustible"; summary: FuelSummary };

/** One page of the active tab's rows, with the totals of everything the filters match. */
export type LogbookData =
  | { tab: "servicios"; rows: ServiceRow[]; summary: CostSummary }
  | { tab: "aceite"; rows: OilRow[]; summary: CostSummary }
  | { tab: "llantas"; rows: TireRow[]; summary: CostSummary }
  | { tab: "combustible"; rows: FuelRow[]; summary: FuelSummary };

/** What the page lists for the chosen vehicle. */
export interface VehicleListing {
  plate: string;
  data: LogbookData;
  page: number;
  hasNext: boolean;
  /** Drivers who ever had the vehicle, for the driver filter. */
  drivers: Array<{ id: number; name: string }>;
}

export interface LogbookPage {
  /** Fleet-wide totals for the date range and group (never narrowed by plate or search). */
  fleet: TabSummary;
  /** Null until a vehicle is chosen: the fleet list is never loaded. */
  vehicle: VehicleListing | null;
  /** Providers already used, for the forms' suggestions. */
  providers: string[];
  /** Plates that can still receive records (not sold). */
  plates: string[];
  today: IsoDate;
}

async function loadFleetSummary(tab: LogbookTab, scope: LogbookScope): Promise<TabSummary> {
  switch (tab) {
    case "servicios":
      return { tab, summary: await summarizeServices(scope) };
    case "aceite":
      return { tab, summary: await summarizeOil(scope) };
    case "llantas":
      return { tab, summary: await summarizeTires(scope) };
    case "combustible":
      return { tab, summary: await summarizeFuelFills(scope) };
  }
}

async function loadVehicleData(
  tab: LogbookTab,
  scope: LogbookScope,
  page: number,
): Promise<{ data: LogbookData; hasNext: boolean }> {
  switch (tab) {
    case "servicios": {
      const [{ rows, hasNext }, summary] = await Promise.all([loadServicePage(scope, page), summarizeServices(scope)]);
      return { data: { tab, rows, summary }, hasNext };
    }
    case "aceite": {
      const [{ rows, hasNext }, summary] = await Promise.all([loadOilPage(scope, page), summarizeOil(scope)]);
      return { data: { tab, rows, summary }, hasNext };
    }
    case "llantas": {
      const [{ rows, hasNext }, summary] = await Promise.all([loadTirePage(scope, page), summarizeTires(scope)]);
      return { data: { tab, rows, summary }, hasNext };
    }
    case "combustible": {
      const [{ rows, hasNext }, summary] = await Promise.all([loadFuelPage(scope, page), summarizeFuelFills(scope)]);
      return { data: { tab, rows, summary }, hasNext };
    }
  }
}

/** The chosen vehicle's page of records, or null when no listed plate matches exactly. */
async function loadVehicleListing(
  tab: LogbookTab,
  query: LogbookQuery,
  plates: string[],
): Promise<VehicleListing | null> {
  const plate = query.plate ? plates.find((p) => normalizePlateQuery(p) === query.plate) : undefined;
  const vehicleId = plate ? await findVehicleIdByPlate(plate) : null;
  if (!plate || vehicleId === null) return null;

  const scope: LogbookScope = {
    vehicleId,
    from: query.from,
    to: query.to,
    group: query.group,
    search: query.search,
    kind: query.kind,
    driverId: query.driverId,
  };
  const [{ data, hasNext }, drivers] = await Promise.all([
    loadVehicleData(tab, scope, query.page),
    loadDriversOfVehicle(vehicleId),
  ]);
  return { plate, data, page: query.page, hasNext, drivers };
}

export async function getLogbookPage(tab: LogbookTab, query: LogbookQuery): Promise<LogbookPage> {
  return loadLogbookPage(tab, query, await currentDay());
}

/** Shared by everyone: the tab and filters (plus the day) are the cache key. */
async function loadLogbookPage(tab: LogbookTab, query: LogbookQuery, today: IsoDate): Promise<LogbookPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("logbookPage"));

  const lists = await loadVehicleFormLists();
  const [fleet, vehicle, providers] = await Promise.all([
    loadFleetSummary(tab, { from: query.from, to: query.to, group: query.group }),
    loadVehicleListing(tab, query, lists.plates),
    loadProviders(),
  ]);
  return { fleet, vehicle, providers, plates: lists.plates, today };
}
