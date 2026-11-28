import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { isInternalClass } from "@/modules/vehicles/domain/internal-classes";
import type { IsoDate } from "@/modules/shared/domain/dates";
import type { TurnPorts, TurnRecord } from "../application/turn-commands";
import type { TurnDayRow, TurnRow } from "../domain/turn-board";

const { turnDays, turns, vehicles, vehicleClasses, user } = schema;

const activeTurn = isNull(turns.cancelledAt);

const dayColumns = { id: turnDays.id, date: turnDays.date, opensAt: turnDays.opensAt, closesAt: turnDays.closesAt };

const turnRecordColumns = {
  id: turns.id,
  turnDayId: turns.turnDayId,
  vehicleId: turns.vehicleId,
  product: turns.product,
  destination: turns.destination,
  neededAt: turns.neededAt,
  createdBy: turns.createdBy,
  createdByName: user.name,
};

/** The commands' port, backed by the database. */
export const turnRepository: TurnPorts = {
  async findDayByDate(date) {
    const [row] = await db.select(dayColumns).from(turnDays).where(eq(turnDays.date, date));
    return row ?? null;
  },

  async findDay(id) {
    const [row] = await db.select(dayColumns).from(turnDays).where(eq(turnDays.id, id));
    return row ?? null;
  },

  async insertDay(input) {
    const [row] = await db.insert(turnDays).values(input).returning(dayColumns);
    return row;
  },

  async updateDayWindow(id, opensAt, closesAt) {
    await db.update(turnDays).set({ opensAt, closesAt, updatedAt: new Date() }).where(eq(turnDays.id, id));
  },

  async findVehicle(id) {
    const [row] = await db.select({ id: vehicles.id, status: vehicles.status }).from(vehicles).where(eq(vehicles.id, id));
    return row ?? null;
  },

  async listActiveTurns(turnDayId): Promise<TurnRecord[]> {
    return db
      .select(turnRecordColumns)
      .from(turns)
      .leftJoin(user, eq(user.id, turns.createdBy))
      .where(and(eq(turns.turnDayId, turnDayId), activeTurn))
      .orderBy(asc(turns.neededAt), asc(turns.createdAt), asc(turns.id));
  },

  async findTurn(id) {
    const [row] = await db
      .select(turnRecordColumns)
      .from(turns)
      .leftJoin(user, eq(user.id, turns.createdBy))
      .where(and(eq(turns.id, id), activeTurn));
    return row ?? null;
  },

  async insertTurn(input) {
    await db.insert(turns).values(input);
  },

  async updateTurn(id, fields) {
    await db.update(turns).set(fields).where(and(eq(turns.id, id), activeTurn));
  },

  async assignVehicle(id, vehicleId) {
    await db.update(turns).set({ vehicleId }).where(and(eq(turns.id, id), activeTurn));
  },

  async cancelTurn(id, cancelledBy, at) {
    await db.update(turns).set({ cancelledAt: at, cancelledBy }).where(and(eq(turns.id, id), activeTurn));
  },

  async deleteTurn(id) {
    await db.delete(turns).where(eq(turns.id, id));
  },
};

/** The jornada of a date, if any. */
export async function loadDayByDate(date: IsoDate): Promise<TurnDayRow | null> {
  return turnRepository.findDayByDate(date);
}

/** The active requests of a jornada with the plate (when assigned) and who made them, by needed hour. */
export async function loadTurnRows(turnDayId: number): Promise<TurnRow[]> {
  return db
    .select({
      id: turns.id,
      vehicleId: turns.vehicleId,
      plate: vehicles.plate,
      product: turns.product,
      destination: turns.destination,
      neededAt: turns.neededAt,
      createdBy: turns.createdBy,
      createdByName: user.name,
      createdAt: turns.createdAt,
    })
    .from(turns)
    .leftJoin(vehicles, eq(vehicles.id, turns.vehicleId))
    .leftJoin(user, eq(user.id, turns.createdBy))
    .where(and(eq(turns.turnDayId, turnDayId), activeTurn))
    .orderBy(asc(turns.neededAt), asc(turns.createdAt), asc(turns.id));
}

/** The active vehicles an admin can assign (the same vehicle may serve several requests of a jornada). */
export async function loadAssignableVehicles(): Promise<Array<{ id: number; plate: string }>> {
  const rows = await db
    .select({ id: vehicles.id, plate: vehicles.plate, className: vehicleClasses.name })
    .from(vehicles)
    .innerJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.classId))
    .where(eq(vehicles.status, "ACTIVE"))
    .orderBy(asc(vehicles.plate));
  return rows.filter((r) => !isInternalClass(r.className)).map(({ id, plate }) => ({ id, plate }));
}

/** The opening and closing instants of the latest jornada: the next one starts from the same hours. */
export async function loadLatestWindow(): Promise<{ opensAt: Date; closesAt: Date } | null> {
  const [row] = await db
    .select({ opensAt: turnDays.opensAt, closesAt: turnDays.closesAt })
    .from(turnDays)
    .orderBy(desc(turnDays.date))
    .limit(1);
  return row ?? null;
}
