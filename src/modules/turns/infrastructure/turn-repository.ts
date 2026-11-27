import { and, asc, desc, eq, isNull, notInArray, sql } from "drizzle-orm";
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
  destination: turns.destination,
  position: turns.position,
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
      .orderBy(asc(turns.position), asc(turns.id));
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

  async cancelTurn(id, cancelledBy, at, renumbered) {
    await db.transaction(async (tx) => {
      await tx.update(turns).set({ cancelledAt: at, cancelledBy }).where(and(eq(turns.id, id), activeTurn));
      for (const { id: turnId, position } of renumbered) {
        await tx.update(turns).set({ position }).where(eq(turns.id, turnId));
      }
    });
  },

  async deleteTurn(id, renumbered) {
    await db.transaction(async (tx) => {
      await tx.delete(turns).where(eq(turns.id, id));
      for (const { id: turnId, position } of renumbered) {
        await tx.update(turns).set({ position }).where(eq(turns.id, turnId));
      }
    });
  },

  async savePositions(updates) {
    await db.transaction(async (tx) => {
      for (const { id, position } of updates) {
        await tx.update(turns).set({ position }).where(and(eq(turns.id, id), activeTurn));
      }
    });
  },
};

/** The jornada of a date, if any. */
export async function loadDayByDate(date: IsoDate): Promise<TurnDayRow | null> {
  return turnRepository.findDayByDate(date);
}

/** The active turns of a jornada with their plate and who enturned them, in queue order. */
export async function loadTurnRows(turnDayId: number): Promise<TurnRow[]> {
  return db
    .select({
      id: turns.id,
      position: turns.position,
      vehicleId: turns.vehicleId,
      plate: vehicles.plate,
      destination: turns.destination,
      createdBy: turns.createdBy,
      createdByName: user.name,
      createdAt: turns.createdAt,
    })
    .from(turns)
    .innerJoin(vehicles, eq(vehicles.id, turns.vehicleId))
    .leftJoin(user, eq(user.id, turns.createdBy))
    .where(and(eq(turns.turnDayId, turnDayId), activeTurn))
    .orderBy(asc(turns.position), asc(turns.id));
}

/** The active vehicles that are not already in the queue of the jornada (all of them without one). */
export async function loadEnturnableVehicles(turnDayId: number | null): Promise<Array<{ id: number; plate: string }>> {
  const queued =
    turnDayId === null
      ? []
      : (await db.select({ vehicleId: turns.vehicleId }).from(turns).where(and(eq(turns.turnDayId, turnDayId), activeTurn))).map(
          (r) => r.vehicleId,
        );
  const rows = await db
    .select({ id: vehicles.id, plate: vehicles.plate, className: vehicleClasses.name })
    .from(vehicles)
    .innerJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.classId))
    .where(and(eq(vehicles.status, "ACTIVE"), queued.length > 0 ? notInArray(vehicles.id, queued) : sql`true`))
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
