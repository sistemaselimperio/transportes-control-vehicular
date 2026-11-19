/**
 * Command use cases for the tire events of a trailer. They validate the business rules and delegate
 * persistence to the `TireEventRepository` port, so they are unit-testable with an in-memory fake.
 */
import type { IsoDate } from "@/modules/shared/domain/dates";
import { assertEditable, assertNotFuture, RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { assertTrailerVehicle, assertValidTireEvent, type TireEventType, type TireEventValues } from "../domain/tire-events";
import type { TireEventRepository, TrailerRef } from "./tire-event-ports";

export interface CommandResult {
  message: string;
}

const CREATED: Record<TireEventType, string> = {
  CHANGE: "Cambio de llanta registrado.",
  REPAIR: "Reparación registrada.",
  ROTATION: "Rotación registrada.",
  INSPECTION: "Inspección registrada.",
};

export function createTireEventCommands(repo: TireEventRepository, today: () => IsoDate) {
  /** The trailer of an existing event, which must still accept changes. */
  async function loadEventTrailer(id: number): Promise<TrailerRef> {
    const vehicle = await repo.findEventVehicle(id);
    if (!vehicle) throw new RuleError("El registro ya no existe.");
    assertTrailerVehicle(vehicle.isTrailer);
    assertEditable(vehicle.status);
    return vehicle;
  }

  return {
    async create(plate: string, values: TireEventValues): Promise<CommandResult> {
      const vehicle = await repo.findVehicle(plate);
      if (!vehicle) throw new RuleError(`El vehículo ${plate} no existe.`);
      assertTrailerVehicle(vehicle.isTrailer);
      assertEditable(vehicle.status);
      assertNotFuture(values.date, today());
      assertValidTireEvent(values);
      await repo.create(vehicle.id, values);
      return { message: CREATED[values.type] };
    },
    async update(id: number, values: TireEventValues): Promise<CommandResult> {
      await loadEventTrailer(id);
      assertNotFuture(values.date, today());
      assertValidTireEvent(values);
      await repo.update(id, values);
      return { message: "Registro actualizado." };
    },
    async remove(id: number): Promise<CommandResult> {
      await loadEventTrailer(id);
      await repo.remove(id);
      return { message: "Registro eliminado." };
    },
  };
}

export type TireEventCommands = ReturnType<typeof createTireEventCommands>;
