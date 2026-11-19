import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { IsoDate } from "@/modules/shared/domain/dates";
import { isTrailerClass } from "@/modules/vehicles/domain/trailer";
import type { TireEventRepository, TrailerRef } from "../application/tire-event-ports";
import type { TireEventRow, TireEventValues } from "../domain/tire-events";
import type { TirePosition } from "../domain/tire-positions";

const t = schema.trailerTireEvents;

type StoredEvent = typeof t.$inferSelect;

/** Every column an event may use; the ones its type does not use are cleared, so changing a type leaves no leftovers. */
function toColumns(values: TireEventValues): Omit<typeof t.$inferInsert, "vehicleId"> {
  const empty = {
    reference: null,
    provider: null,
    price: null,
    notes: null,
    counterpartPosition: null,
    treadDepthMm: null,
    pressurePsi: null,
    condition: null,
  };
  const common = { type: values.type, position: values.position, date: values.date };
  switch (values.type) {
    case "CHANGE":
      return { ...empty, ...common, reference: values.reference.trim(), provider: values.provider, price: values.price, notes: values.notes };
    case "REPAIR":
      return { ...empty, ...common, provider: values.provider, price: values.price, notes: values.notes };
    case "ROTATION":
      return { ...empty, ...common, counterpartPosition: values.counterpart, notes: values.notes ?? null };
    case "INSPECTION":
      return {
        ...empty,
        ...common,
        treadDepthMm: values.treadDepthMm,
        pressurePsi: values.pressurePsi,
        condition: values.condition,
        notes: values.notes ?? null,
      };
  }
}

function toRow(row: StoredEvent): TireEventRow {
  const base = { id: row.id, date: row.date, position: row.position as TirePosition };
  switch (row.type) {
    case "CHANGE":
      return { ...base, type: "CHANGE", reference: row.reference ?? "", provider: row.provider, price: row.price, notes: row.notes };
    case "REPAIR":
      return { ...base, type: "REPAIR", provider: row.provider, price: row.price, notes: row.notes };
    case "ROTATION":
      return { ...base, type: "ROTATION", counterpart: row.counterpartPosition as TirePosition, notes: row.notes };
    case "INSPECTION":
      return {
        ...base,
        type: "INSPECTION",
        treadDepthMm: row.treadDepthMm,
        pressurePsi: row.pressurePsi,
        condition: row.condition,
        notes: row.notes,
      };
  }
}

/** The events of one trailer, newest first; a range narrows them (the Bitácora period). */
export async function listTrailerTireEvents(
  vehicleId: number,
  range: { from?: IsoDate | null; to?: IsoDate | null } = {},
): Promise<TireEventRow[]> {
  const rows = await db
    .select()
    .from(t)
    .where(
      and(
        eq(t.vehicleId, vehicleId),
        range.from ? gte(t.date, range.from) : undefined,
        range.to ? lte(t.date, range.to) : undefined,
      ),
    )
    .orderBy(desc(t.date), desc(t.id));
  return rows.map(toRow);
}

const vehicleColumns = {
  id: schema.vehicles.id,
  status: schema.vehicles.status,
  className: schema.vehicleClasses.name,
};

const toRef = (v: { id: number; status: TrailerRef["status"]; className: string }): TrailerRef => ({
  id: v.id,
  status: v.status,
  isTrailer: isTrailerClass(v.className),
});

export const tireEventRepository: TireEventRepository = {
  async findVehicle(plate) {
    const [vehicle] = await db
      .select(vehicleColumns)
      .from(schema.vehicles)
      .innerJoin(schema.vehicleClasses, eq(schema.vehicles.classId, schema.vehicleClasses.id))
      .where(eq(schema.vehicles.plate, plate));
    return vehicle ? toRef(vehicle) : null;
  },
  async findEventVehicle(id) {
    const [vehicle] = await db
      .select(vehicleColumns)
      .from(t)
      .innerJoin(schema.vehicles, eq(t.vehicleId, schema.vehicles.id))
      .innerJoin(schema.vehicleClasses, eq(schema.vehicles.classId, schema.vehicleClasses.id))
      .where(eq(t.id, id));
    return vehicle ? toRef(vehicle) : null;
  },
  async create(vehicleId, values) {
    await db.insert(t).values({ ...toColumns(values), vehicleId });
  },
  async update(id, values) {
    await db.update(t).set(toColumns(values)).where(eq(t.id, id));
  },
  async remove(id) {
    await db.delete(t).where(eq(t.id, id));
  },
};
