/**
 * Colombian departments and municipalities from DANE's DIVIPOLA
 * (datos.gov.co dataset gdxc-w37w), sorted by name. A vehicle stores the
 * municipality as its label, e.g. "Tunja (Boyacá)", which is unique.
 */
import data from "./colombia-divipola.json";
import { titleCase } from "./title-case";

export interface Municipality {
  /** Five-digit DANE code. */
  code: string;
  name: string;
}

export interface Department {
  /** Two-digit DANE code. */
  code: string;
  name: string;
  cities: readonly Municipality[];
}

export const DEPARTMENTS: readonly Department[] = (
  data as Array<{ code: string; name: string; cities: Array<[string, string]> }>
).map((d) => ({
  code: d.code,
  name: titleCase(d.name),
  cities: d.cities.map(([code, name]) => ({ code, name: titleCase(name) })),
}));

export interface MunicipalityMatch {
  departmentCode: string;
  code: string;
  label: string;
}

const label = (d: Department, m: Municipality) => (m.name === d.name ? m.name : `${m.name} (${d.name})`);

const byCode = new Map<string, MunicipalityMatch>();
const byLabel = new Map<string, MunicipalityMatch>();
for (const d of DEPARTMENTS) {
  for (const m of d.cities) {
    const match = { departmentCode: d.code, code: m.code, label: label(d, m) };
    byCode.set(m.code, match);
    byLabel.set(match.label, match);
  }
}

export function municipalityLabel(code: string): string | null {
  return byCode.get(code)?.label ?? null;
}

export function findMunicipality(stored: string | null): MunicipalityMatch | null {
  return stored ? (byLabel.get(stored) ?? null) : null;
}

export function isMunicipalityLabel(value: string): boolean {
  return byLabel.has(value);
}
