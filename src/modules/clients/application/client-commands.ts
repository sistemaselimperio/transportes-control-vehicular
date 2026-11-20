import type { ClientInput, LocationInput } from "./client-schemas";

/** A rule of the clients refused the operation; the message is for the user. */
export class ClientError extends Error {}

export interface ClientPorts {
  /** Id of the client holding that NIT, ignoring `exceptId`. */
  findClientIdByNit(nit: string, exceptId?: number): Promise<number | null>;
  /** Id of the client whose name has that key (case, accents and spaces ignored), ignoring `exceptId`. */
  findClientIdByNameKey(nameKey: string, exceptId?: number): Promise<number | null>;
  insertClient(values: ClientInput): Promise<void>;
  /** False when no client has that id. */
  updateClient(id: number, values: ClientInput): Promise<boolean>;
  countDeliveries(clientId: number): Promise<number>;
  /** False when no client has that id. */
  deleteClient(id: number): Promise<boolean>;
}

const GONE = "El cliente ya no existe.";
export const NIT_TAKEN = "Ya existe un cliente con ese NIT.";
export const NAME_TAKEN = "Ya existe un cliente con ese nombre.";

export function createClientCommands(ports: ClientPorts) {
  async function ensureUnique(input: ClientInput, exceptId?: number) {
    if (input.nit !== null && (await ports.findClientIdByNit(input.nit, exceptId)) !== null) {
      throw new ClientError(NIT_TAKEN);
    }
    if ((await ports.findClientIdByNameKey(input.nameKey, exceptId)) !== null) throw new ClientError(NAME_TAKEN);
  }

  return {
    async create(input: ClientInput) {
      await ensureUnique(input);
      await ports.insertClient(input);
    },

    async update(id: number, input: ClientInput) {
      await ensureUnique(input, id);
      if (!(await ports.updateClient(id, input))) throw new ClientError(GONE);
    },

    async remove(id: number) {
      const deliveries = await ports.countDeliveries(id);
      if (deliveries > 0) {
        throw new ClientError(
          `No se puede eliminar: el cliente tiene ${deliveries} ${deliveries === 1 ? "entrega registrada" : "entregas registradas"}.`,
        );
      }
      if (!(await ports.deleteClient(id))) throw new ClientError(GONE);
    },
  };
}

export interface LocationPorts {
  clientExists(id: number): Promise<boolean>;
  /** The client a finca belongs to; null when the finca does not exist. */
  findLocationClientId(id: number): Promise<number | null>;
  /** Id of the finca of `clientId` whose name has that key, ignoring `exceptId`. */
  findLocationIdByNameKey(clientId: number, nameKey: string, exceptId?: number): Promise<number | null>;
  insertLocation(clientId: number, values: LocationInput): Promise<void>;
  /** False when no finca has that id. */
  updateLocation(id: number, values: LocationInput): Promise<boolean>;
  /** False when no finca has that id. Deliveries that used it keep existing without a finca. */
  deleteLocation(id: number): Promise<boolean>;
}

const LOCATION_GONE = "La finca ya no existe.";
export const LOCATION_NAME_TAKEN = "Este cliente ya tiene una finca con ese nombre.";

export function createLocationCommands(ports: LocationPorts) {
  async function ensureUniqueName(clientId: number, input: LocationInput, exceptId?: number) {
    if ((await ports.findLocationIdByNameKey(clientId, input.nameKey, exceptId)) !== null) {
      throw new ClientError(LOCATION_NAME_TAKEN);
    }
  }

  return {
    async create(clientId: number, input: LocationInput) {
      if (!(await ports.clientExists(clientId))) throw new ClientError(GONE);
      await ensureUniqueName(clientId, input);
      await ports.insertLocation(clientId, input);
    },

    async update(id: number, input: LocationInput) {
      const clientId = await ports.findLocationClientId(id);
      if (clientId === null) throw new ClientError(LOCATION_GONE);
      await ensureUniqueName(clientId, input, id);
      if (!(await ports.updateLocation(id, input))) throw new ClientError(LOCATION_GONE);
    },

    async remove(id: number) {
      if (!(await ports.deleteLocation(id))) throw new ClientError(LOCATION_GONE);
    },
  };
}
