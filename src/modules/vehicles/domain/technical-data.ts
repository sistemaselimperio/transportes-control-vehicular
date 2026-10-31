/**
 * "Datos generales" of the vehicle's paper folder (registration sheet): identifiers and
 * physical specs. Every field is optional.
 */
import { formatDisplayDate, type IsoDate } from "@/modules/shared/domain/dates";
import { formatKm } from "./vehicle-row";
import { RuleError } from "./vehicle-rules";

export interface VehicleTechnicalData {
  registrationDate: IsoDate | null;
  modelYear: number | null;
  engineNumber: string | null;
  chassisNumber: string | null;
  serialNumber: string | null;
  bodyType: string | null;
  fuelType: string | null;
  /** Free text with its unit, e.g. "34 t" or "40 pasajeros". */
  capacity: string | null;
  /** Engine displacement in cc. */
  engineDisplacement: number | null;
  grossWeightKg: number | null;
  color: string | null;
}

export const EMPTY_TECHNICAL_DATA: VehicleTechnicalData = {
  registrationDate: null,
  modelYear: null,
  engineNumber: null,
  chassisNumber: null,
  serialNumber: null,
  bodyType: null,
  fuelType: null,
  capacity: null,
  engineDisplacement: null,
  grossWeightKg: null,
  color: null,
};

/** Suggestions for the fuel type; any other text is allowed. */
export const FUEL_TYPE_SUGGESTIONS = ["Diésel", "Gasolina", "Gas", "Eléctrico"] as const;

export const MIN_MODEL_YEAR = 1950;

/** The model year may be one year ahead of the calendar (next-year models). */
export function assertModelYear(year: number | null, today: IsoDate): void {
  if (year == null) return;
  const max = Number(today.slice(0, 4)) + 1;
  if (year < MIN_MODEL_YEAR || year > max) {
    throw new RuleError(`El modelo debe estar entre ${MIN_MODEL_YEAR} y ${max}.`);
  }
}

/** Labelled, display-ready rows for the vehicle file; empty values show "—". */
export function technicalRows(data: VehicleTechnicalData): Array<{ label: string; value: string }> {
  const text = (v: string | number | null) => (v == null ? "—" : String(v));
  const unit = (v: number | null, u: string) => (v == null ? "—" : `${formatKm(v)} ${u}`);
  return [
    { label: "Fecha de matrícula", value: data.registrationDate ? formatDisplayDate(data.registrationDate) : "—" },
    { label: "Modelo", value: text(data.modelYear) },
    { label: "Número de motor", value: text(data.engineNumber) },
    { label: "Número de chasis", value: text(data.chassisNumber) },
    { label: "Número de serie", value: text(data.serialNumber) },
    { label: "Tipo de carrocería", value: text(data.bodyType) },
    { label: "Cilindraje", value: unit(data.engineDisplacement, "cc") },
    { label: "Capacidad", value: text(data.capacity) },
    { label: "Peso bruto vehicular", value: unit(data.grossWeightKg, "kg") },
    { label: "Color", value: text(data.color) },
  ];
}

const IDENTIFICATION = new Set(["Fecha de matrícula", "Número de motor", "Número de chasis", "Número de serie"]);

export interface TechnicalGroup {
  title: string;
  rows: Array<{ label: string; value: string }>;
  /** Fields of the group that are on record (not a dash). */
  known: number;
}

/** The technical rows split into what identifies the vehicle and what describes it. */
export function technicalGroups(data: VehicleTechnicalData): TechnicalGroup[] {
  const rows = technicalRows(data);
  const group = (title: string, picked: typeof rows): TechnicalGroup => ({
    title,
    rows: picked,
    known: picked.filter((r) => r.value !== "—").length,
  });
  return [
    group("Identificación", rows.filter((r) => IDENTIFICATION.has(r.label))),
    group("Características", rows.filter((r) => !IDENTIFICATION.has(r.label))),
  ];
}
