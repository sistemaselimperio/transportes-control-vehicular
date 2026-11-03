import { and, desc, eq, gte, like, lte, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { escapeLikePattern, INSPECTIONS_PAGE_SIZE, type InspectionFilters } from "../domain/inspection-filters";
import type { InspectionAnswers, ValidInspection } from "../domain/preoperational-inspection";

const t = schema.preoperationalInspections;

/** What the list shows: no answers and no signature, which are the heavy columns. */
export type InspectionListRow = {
  id: string;
  inspectionDate: string;
  inspectionTime: string;
  plate: string;
  driverName: string;
  route: string;
  hasCriticalFailure: boolean;
};

export type InspectionDetail = InspectionListRow & {
  createdAt: Date;
  trailerPlate: string | null;
  driverNationalId: string;
  odometer: string;
  muleNotApplicable: boolean;
  answers: InspectionAnswers;
  signature: string;
};

export async function insertInspection(value: ValidInspection) {
  await db.insert(t).values({
    inspectionDate: value.date,
    inspectionTime: value.time,
    plate: value.plate,
    trailerPlate: value.trailerPlate,
    driverName: value.driverName,
    driverNationalId: value.driverNationalId,
    odometer: value.odometer,
    route: value.route,
    muleNotApplicable: value.muleNotApplicable,
    answers: value.answers,
    hasCriticalFailure: value.hasCriticalFailure,
    signature: value.signature,
  });
}

/** One page of inspections, newest first; `hasNext` tells whether another page follows. */
export async function listInspections(
  filters: InspectionFilters,
): Promise<{ rows: InspectionListRow[]; hasNext: boolean }> {
  const conditions: SQL[] = [];
  if (filters.plate) conditions.push(like(t.plate, `%${escapeLikePattern(filters.plate)}%`));
  if (filters.from) conditions.push(gte(t.inspectionDate, filters.from));
  if (filters.to) conditions.push(lte(t.inspectionDate, filters.to));

  const rows = await db
    .select({
      id: t.id,
      inspectionDate: t.inspectionDate,
      inspectionTime: t.inspectionTime,
      plate: t.plate,
      driverName: t.driverName,
      route: t.route,
      hasCriticalFailure: t.hasCriticalFailure,
    })
    .from(t)
    .where(and(...conditions))
    .orderBy(desc(t.inspectionDate), desc(t.inspectionTime), desc(t.createdAt))
    .limit(INSPECTIONS_PAGE_SIZE + 1)
    .offset((filters.page - 1) * INSPECTIONS_PAGE_SIZE);

  return { rows: rows.slice(0, INSPECTIONS_PAGE_SIZE), hasNext: rows.length > INSPECTIONS_PAGE_SIZE };
}

export async function findInspection(id: string): Promise<InspectionDetail | null> {
  const [row] = await db.select().from(t).where(eq(t.id, id)).limit(1);
  return row ?? null;
}
