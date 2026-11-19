import type { ClientInput } from "./client-schemas";

/** A rule of the clients refused the operation; the message is for the user. */
export class ClientError extends Error {}

export interface ClientPorts {
  /** Id of the client holding that NIT, ignoring `exceptId`. */
  findClientIdByNit(nit: string, exceptId?: number): Promise<number | null>;
  insertClient(values: ClientInput): Promise<void>;
  /** False when no client has that id. */
  updateClient(id: number, values: ClientInput): Promise<boolean>;
  countDeliveries(clientId: number): Promise<number>;
  /** False when no client has that id. */
  deleteClient(id: number): Promise<boolean>;
}

const GONE = "El cliente ya no existe.";
const NIT_TAKEN = "Ya existe un cliente con ese NIT.";

export function createClientCommands(ports: ClientPorts) {
  async function ensureUniqueNit(input: ClientInput, exceptId?: number) {
    if (input.nit !== null && (await ports.findClientIdByNit(input.nit, exceptId)) !== null) {
      throw new ClientError(NIT_TAKEN);
    }
  }

  return {
    async create(input: ClientInput) {
      await ensureUniqueNit(input);
      await ports.insertClient(input);
    },

    async update(id: number, input: ClientInput) {
      await ensureUniqueNit(input, id);
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
