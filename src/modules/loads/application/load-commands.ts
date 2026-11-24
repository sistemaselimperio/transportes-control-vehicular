import { type FindCatalogProducts, productLabel } from "@/modules/orders/domain/catalog";
import { unavailableOrderIds, type OrderStatus } from "@/modules/orders/domain/order-rules";
import { firstDuplicate } from "../domain/load-lines";
import type { LoadInput } from "./load-schemas";

/** A rule of the loads refused the operation; the message is for the user. */
export class LoadError extends Error {}

/** What the repository stores: the header with the vehicle link, the lines with their reference ids. */
export interface LoadValues extends Omit<LoadInput, "lines"> {
  vehicleId: number | null;
  lines: ReadonlyArray<{ referenceId: number; tons: number; cost: number; siesaNumber: string; orderNumber: string }>;
}

export interface LoadPorts {
  /** A fleet vehicle that has not been sold, by normalized plate. */
  findVehicleByPlate(plate: string): Promise<{ id: number; plate: string } | null>;
  findLoad(id: number): Promise<{ plate: string; vehicleId: number | null } | null>;
  /** The SIESA numbers among `numbers` already held by a line of another load (ignoring load `exceptId`). */
  findTakenSiesa(numbers: string[], exceptId?: number): Promise<string[]>;
  /** The catalog products among `ids`; legacy products (no code) and unknown ids are left out. */
  findCatalogProducts: FindCatalogProducts;
  /** The orders among `ids` that exist, with their status and the load they belong to. */
  findOrdersByIds(ids: number[]): Promise<Array<{ id: number; status: OrderStatus; loadId: number | null }>>;
  /**
   * Stores the load and, in the same transaction, marks `values.orderIds` as loaded. False (nothing
   * stored) when one of those orders stopped being available meanwhile.
   */
  insertLoad(values: LoadValues): Promise<boolean>;
  /**
   * Updates the load; its orders become exactly `values.orderIds` (the ones unchecked go back to
   * pending), all in one transaction. "gone" when no load has that id, "orders_unavailable" (nothing
   * changed) when a checked order stopped being available.
   */
  updateLoad(id: number, values: LoadValues): Promise<"ok" | "gone" | "orders_unavailable">;
  /** Deletes the load and returns its orders to pending in the same transaction. False when no load has that id. */
  deleteLoad(id: number): Promise<boolean>;
}

/** Fallback for a race the command's own check did not catch. */
export const SIESA_TAKEN = "Ya existe un cargue con ese número SIESA.";
export const siesaTaken = (siesa: string) => `Ya existe un cargue con el número SIESA ${siesa}.`;
const NO_LINES = "Agrega al menos un producto al cargue.";
const siesaRepeated = (siesa: string) => `El número SIESA ${siesa} está repetido en el cargue.`;
const GONE = "El cargue ya no existe.";
const PRODUCT_GONE = "Un producto del cargue ya no está en el catálogo.";
const foreignProduct = (label: string, supplier: string) => `El producto ${label} no es del proveedor ${supplier}.`;
const NOT_IN_FLEET = "Elige una placa de la flota.";
export const ORDERS_UNAVAILABLE = "Algún pedido ya no está disponible: está anulado o ya pertenece a otro cargue.";

export function createLoadCommands(ports: LoadPorts) {
  /** At least one line, no SIESA repeated inside the load or held by another load. */
  async function ensureLines(input: LoadInput, exceptId?: number) {
    if (input.lines.length === 0) throw new LoadError(NO_LINES);
    const numbers = input.lines.map((l) => l.siesaNumber);
    const repeated = firstDuplicate(numbers);
    if (repeated !== null) throw new LoadError(siesaRepeated(repeated));
    const [taken] = await ports.findTakenSiesa(numbers, exceptId);
    if (taken !== undefined) throw new LoadError(siesaTaken(taken));
  }

  /** Every line must carry a catalog product of the load's supplier; run once every other check passed. */
  async function prepare(input: LoadInput, owner: { plate: string; vehicleId: number | null }): Promise<LoadValues> {
    const wanted = [...new Set(input.lines.map((l) => l.referenceId))];
    const products = new Map((await ports.findCatalogProducts(wanted)).map((p) => [p.id, p]));
    for (const id of wanted) {
      const product = products.get(id);
      if (!product) throw new LoadError(PRODUCT_GONE);
      if (product.supplier !== input.supplier) throw new LoadError(foreignProduct(productLabel(product), input.supplier));
    }
    return {
      date: input.date,
      supplier: input.supplier,
      plate: owner.plate,
      vehicleId: owner.vehicleId,
      notes: input.notes,
      orderIds: input.orderIds,
      lines: input.lines.map((l) => ({
        referenceId: l.referenceId,
        tons: l.tons,
        cost: l.cost,
        siesaNumber: l.siesaNumber,
        orderNumber: l.orderNumber,
      })),
    };
  }

  /** The checked orders must be pending, or already linked to this same load. */
  async function ensureOrdersAvailable(orderIds: readonly number[], loadId?: number) {
    if (orderIds.length === 0) return;
    const found = await ports.findOrdersByIds([...orderIds]);
    if (unavailableOrderIds(found, orderIds, loadId).length > 0) throw new LoadError(ORDERS_UNAVAILABLE);
  }

  return {
    async create(input: LoadInput) {
      const vehicle = await ports.findVehicleByPlate(input.plate);
      if (!vehicle) throw new LoadError(NOT_IN_FLEET);
      await ensureLines(input);
      await ensureOrdersAvailable(input.orderIds);
      if (!(await ports.insertLoad(await prepare(input, { plate: vehicle.plate, vehicleId: vehicle.id })))) {
        throw new LoadError(ORDERS_UNAVAILABLE);
      }
    },

    async update(id: number, input: LoadInput) {
      const stored = await ports.findLoad(id);
      if (!stored) throw new LoadError(GONE);
      const vehicle = await ports.findVehicleByPlate(input.plate);
      let owner: { plate: string; vehicleId: number | null };
      if (vehicle) {
        owner = { plate: vehicle.plate, vehicleId: vehicle.id };
      } else if (stored.plate === input.plate) {
        // The vehicle left the fleet since: the load keeps the plate and link it was saved with.
        owner = { plate: input.plate, vehicleId: stored.vehicleId };
      } else {
        throw new LoadError(NOT_IN_FLEET);
      }
      await ensureLines(input, id);
      await ensureOrdersAvailable(input.orderIds, id);
      const result = await ports.updateLoad(id, await prepare(input, owner));
      if (result === "gone") throw new LoadError(GONE);
      if (result === "orders_unavailable") throw new LoadError(ORDERS_UNAVAILABLE);
    },

    async remove(id: number) {
      if (!(await ports.deleteLoad(id))) throw new LoadError(GONE);
    },
  };
}
