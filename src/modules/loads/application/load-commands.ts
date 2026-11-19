import type { LoadInput } from "./load-schemas";

/** A rule of the loads refused the operation; the message is for the user. */
export class LoadError extends Error {}

export interface LoadValues extends LoadInput {
  vehicleId: number | null;
}

export interface LoadPorts {
  /** A fleet vehicle that has not been sold, by normalized plate. */
  findVehicleByPlate(plate: string): Promise<{ id: number; plate: string } | null>;
  findLoad(id: number): Promise<{ plate: string; vehicleId: number | null } | null>;
  /** Id of the load holding that SIESA number, ignoring `exceptId`. */
  findLoadIdBySiesa(siesaNumber: string, exceptId?: number): Promise<number | null>;
  insertLoad(values: LoadValues): Promise<void>;
  /** False when no load has that id. */
  updateLoad(id: number, values: LoadValues): Promise<boolean>;
  /** False when no load has that id. */
  deleteLoad(id: number): Promise<boolean>;
}

export const SIESA_TAKEN = "Ya existe un cargue con ese número SIESA.";
const GONE = "El cargue ya no existe.";
const NOT_IN_FLEET = "Elige una placa de la flota.";

export function createLoadCommands(ports: LoadPorts) {
  async function ensureUniqueSiesa(input: LoadInput, exceptId?: number) {
    if ((await ports.findLoadIdBySiesa(input.siesaNumber, exceptId)) !== null) throw new LoadError(SIESA_TAKEN);
  }

  return {
    async create(input: LoadInput) {
      const vehicle = await ports.findVehicleByPlate(input.plate);
      if (!vehicle) throw new LoadError(NOT_IN_FLEET);
      await ensureUniqueSiesa(input);
      await ports.insertLoad({ ...input, plate: vehicle.plate, vehicleId: vehicle.id });
    },

    async update(id: number, input: LoadInput) {
      const stored = await ports.findLoad(id);
      if (!stored) throw new LoadError(GONE);
      const vehicle = await ports.findVehicleByPlate(input.plate);
      let values: LoadValues;
      if (vehicle) {
        values = { ...input, plate: vehicle.plate, vehicleId: vehicle.id };
      } else if (stored.plate === input.plate) {
        // The vehicle left the fleet since: the load keeps the plate and link it was saved with.
        values = { ...input, vehicleId: stored.vehicleId };
      } else {
        throw new LoadError(NOT_IN_FLEET);
      }
      await ensureUniqueSiesa(input, id);
      if (!(await ports.updateLoad(id, values))) throw new LoadError(GONE);
    },

    async remove(id: number) {
      if (!(await ports.deleteLoad(id))) throw new LoadError(GONE);
    },
  };
}
