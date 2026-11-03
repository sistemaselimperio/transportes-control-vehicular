/**
 * Validation of a submitted pre-operational inspection (form FO-PESV-016). The public form runs it
 * before sending and the server action runs it again: the server never trusts the client. Header
 * values are free text on purpose, they are not checked against the fleet or the drivers.
 */
import { ALL_CHECKLIST_ITEMS, PREOPERATIONAL_CHECKLIST, type ChecklistItem } from "./preoperational-checklist";

export type AnswerStatus = "BIEN" | "MAL";

export type InspectionAnswer = { status: AnswerStatus; note?: string };

/** Checklist item id to its answer; a mule-only item is absent when the mule section does not apply. */
export type InspectionAnswers = Record<string, InspectionAnswer>;

export type ValidInspection = {
  /** YYYY-MM-DD, Colombia calendar date. */
  date: string;
  /** HH:MM, Colombia local time. */
  time: string;
  plate: string;
  trailerPlate: string | null;
  driverName: string;
  driverNationalId: string;
  odometer: string;
  route: string;
  muleNotApplicable: boolean;
  answers: InspectionAnswers;
  hasCriticalFailure: boolean;
  /** PNG data URL of the drawn signature. */
  signature: string;
};

/** Keyed by header field name, checklist item id or `signature`; the value is the user-facing message. */
export type InspectionErrors = Record<string, string>;

export type InspectionValidation = { ok: true; value: ValidInspection } | { ok: false; errors: InspectionErrors };

export const MAX_PLATE_LENGTH = 15;
export const MAX_NAME_LENGTH = 100;
export const MAX_NATIONAL_ID_LENGTH = 20;
export const MAX_ODOMETER_LENGTH = 20;
export const MAX_ROUTE_LENGTH = 200;
export const MAX_NOTE_LENGTH = 500;
/** Characters of the whole data URL: a drawn signature is a few tens of KB. */
export const MAX_SIGNATURE_LENGTH = 400_000;

const SIGNATURE_PATTERN = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

/** Plates are free text here: trimmed, no inner spaces, upper case. */
export function normalizeInspectionPlate(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

const collapseSpaces = (value: string) => value.trim().replace(/\s+/g, " ");

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** The items the inspector has to answer: all of them, minus the mule ones when those do not apply. */
export function applicableItems(muleNotApplicable: boolean): readonly ChecklistItem[] {
  return PREOPERATIONAL_CHECKLIST.filter((section) => !(muleNotApplicable && section.muleOnly)).flatMap(
    (section) => section.items,
  );
}

/** The critical points marked MAL, in form order: when any exists the vehicle does not leave. */
export function failedCriticalItems(answers: InspectionAnswers): ChecklistItem[] {
  return ALL_CHECKLIST_ITEMS.filter((item) => item.critical && answers[item.id]?.status === "MAL");
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const asText = (value: unknown) => (typeof value === "string" ? value : "");

export function validateInspection(input: unknown): InspectionValidation {
  const raw = asRecord(input);
  if (!raw) return { ok: false, errors: { form: "Revisa los datos ingresados." } };

  const errors: InspectionErrors = {};

  const date = asText(raw.date).trim();
  if (!isIsoDate(date)) errors.date = "Indica una fecha válida.";

  const time = asText(raw.time).trim();
  if (!isTime(time)) errors.time = "Indica una hora válida.";

  const required = (field: string, value: string, max: number, missing: string) => {
    if (!value) errors[field] = missing;
    else if (value.length > max) errors[field] = `Máximo ${max} caracteres.`;
    return value;
  };

  const plate = required("plate", normalizeInspectionPlate(asText(raw.plate)), MAX_PLATE_LENGTH, "Escribe la placa.");
  const trailerPlateText = normalizeInspectionPlate(asText(raw.trailerPlate));
  if (trailerPlateText.length > MAX_PLATE_LENGTH) errors.trailerPlate = `Máximo ${MAX_PLATE_LENGTH} caracteres.`;
  const driverName = required("driverName", collapseSpaces(asText(raw.driverName)), MAX_NAME_LENGTH, "Escribe el nombre del conductor.");
  const driverNationalId = required("driverId", collapseSpaces(asText(raw.driverId)), MAX_NATIONAL_ID_LENGTH, "Escribe la cédula.");
  const odometer = required("odometer", collapseSpaces(asText(raw.odometer)), MAX_ODOMETER_LENGTH, "Escribe el kilometraje.");
  const route = required("route", collapseSpaces(asText(raw.route)), MAX_ROUTE_LENGTH, "Escribe la ruta o el destino.");

  const muleNotApplicable = raw.muleNotApplicable === true;
  const rawAnswers = asRecord(raw.answers) ?? {};
  const answers: InspectionAnswers = {};

  for (const item of applicableItems(muleNotApplicable)) {
    const answer = asRecord(rawAnswers[item.id]);
    const status = answer?.status;
    if (status !== "BIEN" && status !== "MAL") {
      errors[item.id] = "Marca BIEN o MAL.";
      continue;
    }
    if (status === "BIEN") {
      answers[item.id] = { status };
      continue;
    }
    const note = collapseSpaces(asText(answer?.note));
    if (!note) errors[item.id] = "Describe qué encontraste.";
    else if (note.length > MAX_NOTE_LENGTH) errors[item.id] = `Máximo ${MAX_NOTE_LENGTH} caracteres.`;
    else answers[item.id] = { status, note };
  }

  const signature = asText(raw.signature);
  if (!signature) errors.signature = "Firma en el recuadro.";
  else if (signature.length > MAX_SIGNATURE_LENGTH || !SIGNATURE_PATTERN.test(signature)) {
    errors.signature = "La firma no es válida. Bórrala y vuelve a firmar.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      date,
      time,
      plate,
      trailerPlate: trailerPlateText || null,
      driverName,
      driverNationalId,
      odometer,
      route,
      muleNotApplicable,
      answers,
      hasCriticalFailure: failedCriticalItems(answers).length > 0,
      signature,
    },
  };
}

/** Current Colombia date and time (America/Bogota, no daylight saving), the form defaults. */
export function bogotaDateTime(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
