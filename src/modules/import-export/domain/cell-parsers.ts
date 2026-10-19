/**
 * Pure parsers for the messy cells of the legacy Excel. Every parser returns a
 * value plus issues (Spanish messages for the operator); a bad cell never
 * throws: the field stays empty and the issue explains why.
 */
import { normalizePlate } from "@/modules/vehicles/domain/plate";
import type { IsoDate } from "@/modules/shared/domain/dates";

export type CellValue = string | number | Date | null;

export interface Issue {
  level: "error" | "warning";
  field: string;
  message: string;
}

export type ClassName =
  | "Automóvil"
  | "Campero"
  | "Camioneta"
  | "Camión"
  | "Tractocamión"
  | "Turbo"
  | "Motocicleta"
  | "Motocarro"
  | "Tractor"
  | "Remolque";

export type StatusWord = "IDLE" | "IN_WORKSHOP";
export type TaxKind = "PAID_YEAR" | "EXEMPT" | "EXEMPT_LOW_DISPLACEMENT" | "UNKNOWN";
export type PolicyKind = "TR" | "RC";

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/* ------------------------------ helpers ------------------------------ */

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Trimmed text with collapsed whitespace/newlines. Dates and null give "". */
export function cellText(v: CellValue): string {
  if (v == null || v instanceof Date) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function upper(v: CellValue): string {
  return stripAccents(cellText(v)).toUpperCase();
}

function issue(
  level: Issue["level"],
  field: string,
  message: string,
): Issue {
  return { level, field, message };
}

function isoFromParts(y: number, m: number, d: number): IsoDate | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/* ------------------------------- dates ------------------------------- */

export function parseDateCell(
  v: CellValue,
  field: string,
): { value: IsoDate | null; issues: Issue[] } {
  if (v == null) return { value: null, issues: [] };

  let y: number;
  let m: number;
  let d: number;
  let shown: string;

  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) {
      return { value: null, issues: [issue("error", field, "Fecha no válida.")] };
    }
    y = v.getUTCFullYear();
    m = v.getUTCMonth() + 1;
    d = v.getUTCDate();
    // Excel's zero date (formulas pointing at empty cells): no data.
    if (y === 1899) return { value: null, issues: [] };
    shown = String(y);
  } else if (typeof v === "string") {
    const text = cellText(v);
    if (text === "") return { value: null, issues: [] };
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (!match) {
      return {
        value: null,
        issues: [issue("error", field, `Fecha no válida: "${text}".`)],
      };
    }
    d = Number(match[1]);
    m = Number(match[2]);
    y = Number(match[3]);
    shown = match[3];
    if (isoFromParts(y, m, d) === null) {
      return {
        value: null,
        issues: [issue("error", field, `Fecha inexistente: "${text}".`)],
      };
    }
  } else {
    return {
      value: null,
      issues: [issue("error", field, `Fecha no válida: "${v}".`)],
    };
  }

  if (y < MIN_YEAR || y > MAX_YEAR) {
    return {
      value: null,
      issues: [
        issue(
          "error",
          field,
          `Año fuera de rango (${shown}); se dejó vacío. Debe estar entre ${MIN_YEAR} y ${MAX_YEAR}.`,
        ),
      ],
    };
  }
  return { value: isoFromParts(y, m, d), issues: [] };
}

const NOT_APPLICABLE = /^(NUEVA|NO TIENE|NO APLICA|N\/A)$/;

export function parseDocumentCell(
  v: CellValue,
  field: string,
): { expiresOn: IsoDate | null; notApplicable: boolean; issues: Issue[] } {
  if (typeof v === "string" && NOT_APPLICABLE.test(upper(v))) {
    return { expiresOn: null, notApplicable: true, issues: [] };
  }
  const { value, issues } = parseDateCell(v, field);
  return { expiresOn: value, notApplicable: false, issues };
}

export function parsePolicyCell(v: CellValue): {
  kind: PolicyKind | null;
  expiresOn: IsoDate | null;
  notApplicable: boolean;
  sold: boolean;
  note: string | null;
  issues: Issue[];
} {
  const base = {
    kind: null as PolicyKind | null,
    expiresOn: null as IsoDate | null,
    notApplicable: false,
    sold: false,
    note: null as string | null,
    issues: [] as Issue[],
  };
  if (v == null) return base;
  if (v instanceof Date) {
    const r = parseDateCell(v, "Póliza");
    return { ...base, expiresOn: r.value, issues: r.issues };
  }

  const text = cellText(v);
  if (text === "") return base;
  const up = upper(text);

  if (up.startsWith("NO TIENE")) return { ...base, notApplicable: true };
  if (up.startsWith("VENDIDA")) return { ...base, sold: true };
  if (up === "COMPRO" || up.startsWith("NO HAY CARPETA")) {
    return { ...base, note: `Póliza: ${text}` };
  }

  const withKind = /^(TR|RC)\s+(.+)$/.exec(up);
  if (withKind) {
    const r = parseDateCell(withKind[2], "Póliza");
    return {
      ...base,
      kind: withKind[1] as PolicyKind,
      expiresOn: r.value,
      issues: r.issues,
    };
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(up)) {
    const r = parseDateCell(up, "Póliza");
    return { ...base, expiresOn: r.value, issues: r.issues };
  }
  return {
    ...base,
    note: `Póliza: ${text}`,
    issues: [issue("warning", "Póliza", `Valor de póliza no reconocido: "${text}".`)],
  };
}

/* -------------------------------- tax -------------------------------- */

export function parseTaxCell(
  v: CellValue,
  currentYear: number,
): { kind: TaxKind; year: number | null; issues: Issue[] } {
  const unknown = (issues: Issue[] = []) => ({
    kind: "UNKNOWN" as TaxKind,
    year: null,
    issues,
  });
  if (v == null || v instanceof Date) return unknown();

  const text = upper(v);
  if (text === "" || text === "0") return unknown();

  if (/^\d{4}$/.test(text)) {
    const year = Number(text);
    if (year >= MIN_YEAR && year <= MAX_YEAR) {
      return { kind: "PAID_YEAR", year, issues: [] };
    }
    return unknown([issue("warning", "Impuesto", `Año de impuesto fuera de rango: ${year}.`)]);
  }
  if (text === "AL DIA") return { kind: "PAID_YEAR", year: currentYear, issues: [] };
  if (text.startsWith("NO PAGA POR")) {
    return { kind: "EXEMPT_LOW_DISPLACEMENT", year: null, issues: [] };
  }
  if (text.startsWith("NO PAGA")) return { kind: "EXEMPT", year: null, issues: [] };

  return unknown([
    issue("warning", "Impuesto", `Valor de impuesto no reconocido: "${cellText(v)}".`),
  ]);
}

/* -------------------------- km / phone / service -------------------------- */

const BROKEN_ODOMETER = /NO\s+(SE\s+SI\s+)?SIRVE/;

export function parseKmCell(v: CellValue): {
  km: number | null;
  odometerWorking: boolean;
  issues: Issue[];
} {
  if (v == null || v instanceof Date) {
    return { km: null, odometerWorking: true, issues: [] };
  }
  if (typeof v === "number") {
    return v >= 0
      ? { km: Math.round(v), odometerWorking: true, issues: [] }
      : {
          km: null,
          odometerWorking: true,
          issues: [issue("warning", "Kilometraje", `Kilometraje negativo: ${v}.`)],
        };
  }
  const text = upper(v);
  if (text === "") return { km: null, odometerWorking: true, issues: [] };
  if (BROKEN_ODOMETER.test(text)) {
    return { km: null, odometerWorking: false, issues: [] };
  }
  return {
    km: null,
    odometerWorking: true,
    issues: [
      issue("warning", "Kilometraje", `Kilometraje no reconocido: "${cellText(v)}".`),
    ],
  };
}

export function parsePhoneCell(v: CellValue): {
  phone: string | null;
  note: string | null;
} {
  if (v == null) return { phone: null, note: null };
  if (v instanceof Date) {
    return {
      phone: null,
      note: `Fecha en la columna Celular: ${v.toISOString().slice(0, 10)}`,
    };
  }
  const text = cellText(v);
  if (text === "") return { phone: null, note: null };
  const digits = text.replace(/\D/g, "");
  if (/^\d+$/.test(text.replace(/\s/g, "")) && digits.length === 10) {
    return { phone: digits, note: null };
  }
  return { phone: null, note: `Celular: ${text}` };
}

export function parseServiceCell(
  v: CellValue,
): "PARTICULAR" | "PUBLICO" | null {
  const text = upper(v);
  if (text === "PUBLICO") return "PUBLICO";
  if (text === "PARTICULAR") return "PARTICULAR";
  return null;
}

/* ------------------------------- classes ------------------------------- */

const CLASS_WORDS: Record<string, ClassName> = {
  TRACTOCAMION: "Tractocamión",
  CAMION: "Camión",
  CAMIONETA: "Camioneta",
  CAMPERO: "Campero",
  AUTOMOVIL: "Automóvil",
  MOTOCICLETA: "Motocicleta",
  MOTOCARRO: "Motocarro",
  MOTOCARO: "Motocarro",
  TURBO: "Turbo",
  TRACTOR: "Tractor",
};

const CLASS_GUESSES: Array<[RegExp, ClassName]> = [
  [/PRADO|VITARA|LAND CRUISER/, "Campero"],
  [/SWIF|SUZUKI|COOPER|KWID|RENAULT/, "Automóvil"],
];

export function parseClassCell(v: CellValue): {
  className: ClassName | null;
  brandLine: string | null;
  guessed: boolean;
  issues: Issue[];
} {
  const text = cellText(v);
  if (text === "") {
    return { className: null, brandLine: null, guessed: false, issues: [] };
  }
  const [first, ...rest] = text.split(" ");
  const known = CLASS_WORDS[stripAccents(first).toUpperCase()];
  if (known) {
    return {
      className: known,
      brandLine: rest.join(" ") || null,
      guessed: false,
      issues: [],
    };
  }

  const up = stripAccents(text).toUpperCase();
  const guess = CLASS_GUESSES.find(([re]) => re.test(up))?.[1] ?? "Automóvil";
  return {
    className: guess,
    brandLine: text,
    guessed: true,
    issues: [
      issue(
        "warning",
        "Clase",
        `Clase no indicada en "${text}"; se asumió ${guess}. Revisar.`,
      ),
    ],
  };
}

/* ------------------------- status words and drivers ------------------------- */

export function detectStatusWord(v: CellValue): StatusWord | null {
  const text = upper(v);
  if (/\bTALLER\b/.test(text)) return "IN_WORKSHOP";
  if (/\bQU?IETA\b/.test(text)) return "IDLE";
  return null;
}

export function parseDriverCell(v: CellValue): {
  driverName: string | null;
  status: StatusWord | null;
  note: string | null;
} {
  const text = cellText(v);
  const none = { driverName: null, status: null, note: null };
  if (text === "") return none;
  const up = stripAccents(text).toUpperCase();

  const status = detectStatusWord(text);
  if (status) {
    const plain = /^(QU?IETA|TALLER)$/.test(up);
    return { driverName: null, status, note: plain ? null : `Conductor: ${text}` };
  }
  if (/^SIN\s+AS[IU]GNAR/.test(up)) return none;
  if (
    up.startsWith("CONDUCTOR NO FIJO") ||
    /^(COMEN|VOLVADO|VOLCADO)/.test(up) ||
    up === "ALMACEN"
  ) {
    return { driverName: null, status: null, note: `Conductor: ${text}` };
  }
  return { driverName: text, status: null, note: null };
}

/** Key to deduplicate drivers typed with different spacing/accents. */
export function driverKey(name: string): string {
  return stripAccents(name).toUpperCase().replace(/\s+/g, " ").trim();
}

/* ------------------------------ oil changes ------------------------------ */

export function parseOilDateCell(v: CellValue): {
  date: IsoDate | null;
  status: StatusWord | null;
  issues: Issue[];
} {
  if (typeof v === "string") {
    const up = upper(v);
    if (up === "" || up.startsWith("NO HAY REGISTRO")) {
      return { date: null, status: null, issues: [] };
    }
    const status = detectStatusWord(v);
    if (status) return { date: null, status, issues: [] };
  }
  const r = parseDateCell(v, "F. cambio");
  return { date: r.value, status: null, issues: r.issues };
}

export function parseNextChangeCell(
  v: CellValue,
  field = "Próx. cambio",
): {
  nextKm: number | null;
  nextDate: IsoDate | null;
  status: StatusWord | null;
  issues: Issue[];
} {
  const empty = { nextKm: null, nextDate: null, status: null, issues: [] as Issue[] };
  if (v == null) return empty;
  if (typeof v === "number") {
    return v > 0 ? { ...empty, nextKm: Math.round(v) } : empty;
  }
  if (typeof v === "string") {
    if (cellText(v) === "") return empty;
    const status = detectStatusWord(v);
    if (status) return { ...empty, status };
  }
  const r = parseDateCell(v, field);
  return { ...empty, nextDate: r.value, issues: r.issues };
}

/* -------------------------------- plates -------------------------------- */

const PLATE_SHAPES = [
  /^[A-Z]{3}-\d{3}$/, // car / truck
  /^[A-Z]{3}\d{2}[A-Z]$/, // motorcycle
  /^[A-Z]\d{2}-[A-Z]{3}$/, // motocarro
  /^[A-Z]\d{5}$/, // trailer
];

export function isPlateLike(raw: CellValue): boolean {
  const compact = cellText(raw).replace(/\s+/g, "").toUpperCase();
  if (compact === "") return false;
  const normalized = normalizePlate(compact);
  return PLATE_SHAPES.some((re) => re.test(normalized));
}

export function parsePlateCell(raw: CellValue): {
  plate: string | null;
  issues: Issue[];
} {
  if (!isPlateLike(raw)) {
    const text = cellText(raw);
    return {
      plate: null,
      issues: [
        issue(
          "error",
          "Placa",
          text === ""
            ? "La fila no tiene placa."
            : `Placa no válida: "${text}". La fila no se importa.`,
        ),
      ],
    };
  }
  return { plate: normalizePlate(cellText(raw)), issues: [] };
}

export function parseTrailerReference(v: CellValue): {
  plateText: string;
  brandLine: string | null;
  note: string | null;
} {
  const text = cellText(v);
  const [plateText = "", ...rest] = text.split(" ");
  let remainder = rest.join(" ");
  let note: string | null = null;
  const old = /\(([^)]+)\)/.exec(remainder);
  if (old) {
    note = `Placa anterior (${old[1].trim()})`;
    remainder = remainder.replace(old[0], "").replace(/\s+/g, " ").trim();
  }
  return { plateText, brandLine: remainder || null, note };
}
