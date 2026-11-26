import type { FindCatalogProducts } from "../domain/catalog";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { deliveryBlockReason, type DeliveryBalance } from "../domain/order-delivery";
import { canEditOrder, isValidKgPerBag, type OrderStatus } from "../domain/order-rules";
import { DUPLICATE_PRODUCT, type OrderInput } from "./order-schemas";

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
  /** The catalog products among `ids` (those with a code), legacy and missing ones are left out. */
  findCatalogProducts: FindCatalogProducts;
  /** The persisted status and whether any load already took part of the order. */
  findOrder(id: number): Promise<{ status: OrderStatus; hasLoads: boolean } | null>;
  /** Stores the order, pending, with its lines; returns its id. */
  insertOrder(values: OrderValues): Promise<number>;
  /** Replaces the order's data and lines; false when it is gone, no longer pending or already taken by a load. */
  replaceOrder(id: number, values: OrderValues): Promise<boolean>;
  /** Marks a pending order as annulled; false when it is gone, no longer pending or already taken by a load. */
  annulOrder(id: number): Promise<boolean>;
  saveKgPerBag(value: number): Promise<void>;
  /** The derived status of the orders among `ids` that exist. */
  findOrdersForDelivery(ids: number[]): Promise<Array<{ id: number; status: OrderStatus }>>;
  /** The balances (bags a truck left behind) of the orders, with their trips. */
  findBalances(orderIds: number[]): Promise<DeliveryBalance[]>;
  /** The orders a load takes part of; none for a free load. */
  findLoadOrderIds(loadId: number): Promise<number[]>;
  /** Marks all the orders as delivered in one go; false (nothing stored) when one of them is gone, annulled or already delivered. */
  markDelivered(ids: number[], date: string, by: string): Promise<boolean>;
  /** Clears the delivery of the orders; returns how many were delivered. */
  clearDelivery(ids: number[]): Promise<number>;
}

const GONE = "El pedido ya no existe.";
const NOT_EDITABLE = "Solo se pueden modificar los pedidos pendientes sin cargues.";
const NOT_ANNULLABLE = "Solo se pueden anular los pedidos pendientes sin cargues.";
const CLIENT_GONE = "Un cliente del pedido ya no existe.";
const FOREIGN_LOCATION = "La finca elegida no pertenece al cliente.";
const MANY_CLIENTS = "Un pedido solo puede tener un cliente.";
const MANY_LOCATIONS = "Un pedido solo puede tener una finca.";
const NOTHING_TO_DELIVER = "Elige al menos un pedido.";
const FUTURE_DELIVERY = "La fecha de entrega no puede ser futura.";
const DELIVERY_CHANGED = "Los pedidos cambiaron mientras tanto. Revisa e inténtalo de nuevo.";
const NOT_DELIVERED = "Los pedidos no están entregados.";
const LOAD_WITHOUT_ORDERS = "El cargue no tiene pedidos para entregar.";
const PRODUCT_GONE = "Un producto del pedido ya no está en el catálogo.";

export function createOrderCommands(ports: OrderPorts, today: () => string = todayInBogota) {
  /** Checks the lines against the clients, the fincas and the product catalog. */
  async function prepare(input: OrderInput): Promise<OrderValues> {
    const clientIds = [...new Set(input.lines.map((l) => l.clientId))];
    if (clientIds.length > 1) throw new OrderError(MANY_CLIENTS);
    if (new Set(input.lines.map((l) => l.locationId)).size > 1) throw new OrderError(MANY_LOCATIONS);
    if (new Set(input.lines.map((l) => l.referenceId)).size !== input.lines.length) throw new OrderError(DUPLICATE_PRODUCT);
    const existing = new Set(await ports.findExistingClientIds(clientIds));
    if (clientIds.some((id) => !existing.has(id))) throw new OrderError(CLIENT_GONE);

    const locationIds = [...new Set(input.lines.flatMap((l) => (l.locationId === null ? [] : [l.locationId])))];
    if (locationIds.length > 0) {
      const owners = new Map((await ports.findLocationOwners(locationIds)).map((o) => [o.id, o.clientId]));
      const foreign = input.lines.some((l) => l.locationId !== null && owners.get(l.locationId) !== l.clientId);
      if (foreign) throw new OrderError(FOREIGN_LOCATION);
    }

    const referenceIds = [...new Set(input.lines.map((l) => l.referenceId))];
    const inCatalog = new Set((await ports.findCatalogProducts(referenceIds)).map((p) => p.id));
    if (referenceIds.some((id) => !inCatalog.has(id))) throw new OrderError(PRODUCT_GONE);

    return {
      deliveryDate: input.deliveryDate,
      timeWindow: input.timeWindow,
      note: input.note,
      lines: input.lines.map((l) => ({ clientId: l.clientId, locationId: l.locationId, referenceId: l.referenceId, bags: l.bags })),
    };
  }

  /** Delivers the orders all or nothing; the ones already delivered are skipped. Returns how many were delivered now. */
  async function deliver(ids: readonly number[], date: string, by: string): Promise<number> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) throw new OrderError(NOTHING_TO_DELIVER);
    if (date > today()) throw new OrderError(FUTURE_DELIVERY);
    const found = await ports.findOrdersForDelivery(unique);
    if (unique.some((id) => !found.some((o) => o.id === id))) throw new OrderError(GONE);
    const open = found.filter((o) => o.status !== "entregado");
    const balances = await ports.findBalances(open.map((o) => o.id));
    // With nothing left to deliver the first order explains it ("ya está entregado").
    for (const order of open.length === 0 ? found.slice(0, 1) : open) {
      const reason = deliveryBlockReason(order, balances);
      if (reason !== null) throw new OrderError(reason);
    }
    const openIds = open.map((o) => o.id);
    if (!(await ports.markDelivered(openIds, date, by))) throw new OrderError(DELIVERY_CHANGED);
    return openIds.length;
  }

  async function undoDelivery(ids: readonly number[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) throw new OrderError(NOTHING_TO_DELIVER);
    if ((await ports.clearDelivery(unique)) === 0) throw new OrderError(NOT_DELIVERED);
  }

  async function loadOrderIds(loadId: number): Promise<number[]> {
    const ids = await ports.findLoadOrderIds(loadId);
    if (ids.length === 0) throw new OrderError(LOAD_WITHOUT_ORDERS);
    return ids;
  }

  return {
    deliver,
    undoDelivery,

    /** All the orders of a load at once; refused as a whole when one of them cannot be delivered. */
    async deliverLoad(loadId: number, date: string, by: string): Promise<number> {
      return deliver(await loadOrderIds(loadId), date, by);
    },

    async undoLoadDelivery(loadId: number): Promise<void> {
      await undoDelivery(await loadOrderIds(loadId));
    },

    async create(input: OrderInput): Promise<number> {
      return ports.insertOrder(await prepare(input));
    },

    async update(id: number, input: OrderInput) {
      const stored = await ports.findOrder(id);
      if (!stored) throw new OrderError(GONE);
      if (!canEditOrder(stored.status, stored.hasLoads)) throw new OrderError(NOT_EDITABLE);
      const values = await prepare(input);
      if (!(await ports.replaceOrder(id, values))) throw new OrderError(NOT_EDITABLE);
    },

    async annul(id: number) {
      const stored = await ports.findOrder(id);
      if (!stored) throw new OrderError(GONE);
      if (!canEditOrder(stored.status, stored.hasLoads)) throw new OrderError(NOT_ANNULLABLE);
      if (!(await ports.annulOrder(id))) throw new OrderError(NOT_ANNULLABLE);
    },

    async setKgPerBag(value: number) {
      if (!isValidKgPerBag(value)) throw new OrderError("Los kg por bulto deben ser un número mayor que cero.");
      await ports.saveKgPerBag(value);
    },
  };
}
