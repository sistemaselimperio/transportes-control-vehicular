import { searchKey } from "@/modules/shared/domain/search-key";
import { canEditOrder, isValidKgPerBag, type OrderStatus } from "../domain/order-rules";
import type { OrderInput } from "./order-schemas";

/** A rule of the orders refused the operation; the message is for the user. */
export class OrderError extends Error {}

export interface OrderValues {
  deliveryDate: string;
  timeWindow: string | null;
  note: string | null;
  lines: ReadonlyArray<{ clientId: number; locationId: number | null; referenceId: number; bags: number }>;
}

export interface OrderPorts {
  /** Those of `ids` that are still clients. */
  findExistingClientIds(ids: number[]): Promise<number[]>;
  /** The client each of the given fincas belongs to; a finca that no longer exists is left out. */
  findLocationOwners(ids: number[]): Promise<Array<{ id: number; clientId: number }>>;
  /** The id of every reference by `key` (see `searchKey`), creating the ones that do not exist yet. */
  ensureReferences(refs: ReadonlyArray<{ name: string; key: string }>): Promise<Map<string, number>>;
  findOrder(id: number): Promise<{ status: OrderStatus; loadId: number | null } | null>;
  /** Stores the order, pending, with its lines; returns its id. */
  insertOrder(values: OrderValues): Promise<number>;
  /** Replaces the order's data and lines; false when it is gone or no longer pending. */
  replaceOrder(id: number, values: OrderValues): Promise<boolean>;
  /** Marks a pending order as annulled; false when it is gone or no longer pending. */
  annulOrder(id: number): Promise<boolean>;
  saveKgPerBag(value: number): Promise<void>;
}

const GONE = "El pedido ya no existe.";
const NOT_EDITABLE = "Solo se pueden modificar los pedidos pendientes.";
const NOT_ANNULLABLE = "Solo se pueden anular los pedidos pendientes.";
const CLIENT_GONE = "Un cliente del pedido ya no existe.";
const FOREIGN_LOCATION = "La finca elegida no pertenece al cliente.";

export function createOrderCommands(ports: OrderPorts) {
  /** Checks the lines against the clients and fincas and swaps each reference name for its id. */
  async function prepare(input: OrderInput): Promise<OrderValues> {
    const clientIds = [...new Set(input.lines.map((l) => l.clientId))];
    const existing = new Set(await ports.findExistingClientIds(clientIds));
    if (clientIds.some((id) => !existing.has(id))) throw new OrderError(CLIENT_GONE);

    const locationIds = [...new Set(input.lines.flatMap((l) => (l.locationId === null ? [] : [l.locationId])))];
    if (locationIds.length > 0) {
      const owners = new Map((await ports.findLocationOwners(locationIds)).map((o) => [o.id, o.clientId]));
      const foreign = input.lines.some((l) => l.locationId !== null && owners.get(l.locationId) !== l.clientId);
      if (foreign) throw new OrderError(FOREIGN_LOCATION);
    }

    // The first spelling typed for a name wins; the rest of the lines reuse the same reference.
    const wanted = new Map<string, string>();
    for (const l of input.lines) {
      const key = searchKey(l.reference);
      if (!wanted.has(key)) wanted.set(key, l.reference);
    }
    const referenceIds = await ports.ensureReferences([...wanted].map(([key, name]) => ({ name, key })));

    return {
      deliveryDate: input.deliveryDate,
      timeWindow: input.timeWindow,
      note: input.note,
      lines: input.lines.map((l) => {
        const referenceId = referenceIds.get(searchKey(l.reference));
        if (referenceId === undefined) throw new OrderError("No se pudo registrar la referencia.");
        return { clientId: l.clientId, locationId: l.locationId, referenceId, bags: l.bags };
      }),
    };
  }

  return {
    async create(input: OrderInput): Promise<number> {
      return ports.insertOrder(await prepare(input));
    },

    async update(id: number, input: OrderInput) {
      const stored = await ports.findOrder(id);
      if (!stored) throw new OrderError(GONE);
      if (!canEditOrder(stored.status)) throw new OrderError(NOT_EDITABLE);
      const values = await prepare(input);
      if (!(await ports.replaceOrder(id, values))) throw new OrderError(NOT_EDITABLE);
    },

    async annul(id: number) {
      const stored = await ports.findOrder(id);
      if (!stored) throw new OrderError(GONE);
      if (!canEditOrder(stored.status)) throw new OrderError(NOT_ANNULLABLE);
      if (!(await ports.annulOrder(id))) throw new OrderError(NOT_ANNULLABLE);
    },

    async setKgPerBag(value: number) {
      if (!isValidKgPerBag(value)) throw new OrderError("Los kg por bulto deben ser un número mayor que cero.");
      await ports.saveKgPerBag(value);
    },
  };
}
