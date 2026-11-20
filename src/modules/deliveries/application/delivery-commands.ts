import type { DeliveryStatus } from "../domain/delivery-rules";
import type { DeliveryInput, DestinationInput } from "./delivery-schemas";

/** A rule of the deliveries refused the operation; the message is for the user. */
export class DeliveryError extends Error {}

export interface DeliveryValues extends DeliveryInput {
  vehicleId: number | null;
}

export interface DeliveryPorts {
  clientExists(id: number): Promise<boolean>;
  destinationExists(id: number): Promise<boolean>;
  /** The finca exists and belongs to that client. */
  locationBelongsToClient(locationId: number, clientId: number): Promise<boolean>;
  /** A fleet vehicle that has not been sold, by normalized plate. */
  findVehicleByPlate(plate: string): Promise<{ id: number; plate: string } | null>;
  findDelivery(id: number): Promise<{ plate: string | null; vehicleId: number | null } | null>;
  insertDelivery(values: DeliveryValues): Promise<void>;
  /** False when no delivery has that id. */
  updateDelivery(id: number, values: DeliveryValues): Promise<boolean>;
  /** False when no delivery has that id. */
  setStatus(id: number, status: DeliveryStatus): Promise<boolean>;
  /** False when no delivery has that id. */
  deleteDelivery(id: number): Promise<boolean>;
}

const GONE = "La entrega ya no existe.";
const NOT_IN_FLEET = "Elige una placa de la flota.";

export function createDeliveryCommands(ports: DeliveryPorts) {
  async function ensureReferences(input: DeliveryInput) {
    if (!(await ports.clientExists(input.clientId))) throw new DeliveryError("El cliente ya no existe.");
    if (!(await ports.destinationExists(input.destinationId))) throw new DeliveryError("El destino ya no existe.");
    if (input.locationId !== null && !(await ports.locationBelongsToClient(input.locationId, input.clientId))) {
      throw new DeliveryError("La finca no pertenece al cliente elegido.");
    }
  }

  /** The required vehicle: a fleet plate, or (on update) the plate the delivery was saved with. */
  async function resolveVehicle(
    plate: string,
    stored?: { plate: string | null; vehicleId: number | null },
  ): Promise<{ plate: string; vehicleId: number | null }> {
    const vehicle = await ports.findVehicleByPlate(plate);
    if (vehicle) return { plate: vehicle.plate, vehicleId: vehicle.id };
    // The vehicle left the fleet since: the delivery keeps the plate and link it was saved with.
    if (stored && stored.plate === plate) return { plate, vehicleId: stored.vehicleId };
    throw new DeliveryError(NOT_IN_FLEET);
  }

  return {
    async create(input: DeliveryInput) {
      await ensureReferences(input);
      const vehicle = await resolveVehicle(input.plate);
      await ports.insertDelivery({ ...input, ...vehicle });
    },

    async update(id: number, input: DeliveryInput) {
      const stored = await ports.findDelivery(id);
      if (!stored) throw new DeliveryError(GONE);
      await ensureReferences(input);
      const vehicle = await resolveVehicle(input.plate, stored);
      if (!(await ports.updateDelivery(id, { ...input, ...vehicle }))) throw new DeliveryError(GONE);
    },

    async setStatus(id: number, status: DeliveryStatus) {
      if (!(await ports.setStatus(id, status))) throw new DeliveryError(GONE);
    },

    async remove(id: number) {
      if (!(await ports.deleteDelivery(id))) throw new DeliveryError(GONE);
    },
  };
}

export interface DestinationPorts {
  /** Id of the destination with that name, ignoring `exceptId`. */
  findDestinationIdByName(name: string, exceptId?: number): Promise<number | null>;
  insertDestination(name: string): Promise<void>;
  /** False when no destination has that id. */
  renameDestination(id: number, name: string): Promise<boolean>;
  countDeliveries(destinationId: number): Promise<number>;
  /** False when no destination has that id. */
  deleteDestination(id: number): Promise<boolean>;
}

const DESTINATION_GONE = "El destino ya no existe.";

export function createDestinationCommands(ports: DestinationPorts) {
  async function ensureUnique(name: string, exceptId?: number) {
    if ((await ports.findDestinationIdByName(name, exceptId)) !== null) {
      throw new DeliveryError("Ya existe un destino con ese nombre.");
    }
  }

  return {
    async create(input: DestinationInput) {
      await ensureUnique(input.name);
      await ports.insertDestination(input.name);
    },

    async rename(id: number, input: DestinationInput) {
      await ensureUnique(input.name, id);
      if (!(await ports.renameDestination(id, input.name))) throw new DeliveryError(DESTINATION_GONE);
    },

    async remove(id: number) {
      const deliveries = await ports.countDeliveries(id);
      if (deliveries > 0) {
        throw new DeliveryError(
          `No se puede eliminar: el destino tiene ${deliveries} ${deliveries === 1 ? "entrega registrada" : "entregas registradas"}.`,
        );
      }
      if (!(await ports.deleteDestination(id))) throw new DeliveryError(DESTINATION_GONE);
    },
  };
}
