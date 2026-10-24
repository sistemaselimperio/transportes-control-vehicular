/**
 * Command use cases for the logbook records (services, tire changes, fuel fills).
 * They validate the business rules and delegate persistence to the
 * `LogbookRepository` port, so they are unit-testable with an in-memory fake.
 */
import type { IsoDate } from "@/modules/shared/domain/dates";
import { assertEditable, assertNotFuture, RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import type { EntryKind, LogbookRepository, LogbookValues, VehicleRef } from "./logbook-ports";

export interface CommandResult {
  message: string;
}

const CREATED: Record<EntryKind, string> = {
  service: "Mantenimiento registrado.",
  tire: "Cambio de llantas registrado.",
  fuel: "Tanqueo registrado.",
};

export function createLogbookCommands(repo: LogbookRepository, today: () => IsoDate) {
  /** The vehicle of an existing record, which must still accept changes. */
  async function loadEntryVehicle(kind: EntryKind, id: number): Promise<VehicleRef> {
    const vehicle = await repo.findEntryVehicle(kind, id);
    if (!vehicle) throw new RuleError("El registro ya no existe.");
    assertEditable(vehicle.status);
    return vehicle;
  }

  return {
    async create<K extends EntryKind>(kind: K, plate: string, values: LogbookValues[K]): Promise<CommandResult> {
      const vehicle = await repo.findVehicle(plate);
      if (!vehicle) throw new RuleError(`El vehículo ${plate} no existe.`);
      assertEditable(vehicle.status);
      assertNotFuture(values.date, today());
      await repo.create(kind, vehicle.id, values);
      return { message: CREATED[kind] };
    },
    async update<K extends EntryKind>(kind: K, id: number, values: LogbookValues[K]): Promise<CommandResult> {
      await loadEntryVehicle(kind, id);
      assertNotFuture(values.date, today());
      await repo.update(kind, id, values);
      return { message: "Registro actualizado." };
    },
    async remove(kind: EntryKind, id: number): Promise<CommandResult> {
      await loadEntryVehicle(kind, id);
      await repo.remove(kind, id);
      return { message: "Registro eliminado." };
    },
  };
}

export type LogbookCommands = ReturnType<typeof createLogbookCommands>;
