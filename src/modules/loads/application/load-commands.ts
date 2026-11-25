import { type FindCatalogProducts, productLabel } from "@/modules/orders/domain/catalog";
import type { OrderStatus } from "@/modules/orders/domain/order-rules";
import { allocationErrors, unavailableOrderIds, type AllocationProduct } from "../domain/load-allocation";
import { firstDuplicate } from "../domain/load-lines";
import type { LoadSupplier } from "../domain/load-rules";
import type { LoadInput } from "./load-schemas";

/** A rule of the loads refused the operation; the message is for the user. */
export class LoadError extends Error {}

/** What the repository stores: the header with the vehicle link, the lines with their reference ids. */
export interface LoadValues extends Omit<LoadInput, "lines"> {
  vehicleId: number | null;
  lines: ReadonlyArray<{ orderId: number; referenceId: number; tons: number; cost: number; siesaNumber: string; orderNumber: string }>;
}

/** An order as the load needs it: its derived status, the loads that already took part of it and its product lines. */
export interface OrderForLoad {
  id: number;
  status: OrderStatus;
  loads: ReadonlyArray<{ loadId: number; supplier: LoadSupplier }>;
  lines: readonly AllocationProduct[];
}

export interface LoadPorts {
  /** A fleet vehicle that has not been sold, by normalized plate. */
  findVehicleByPlate(plate: string): Promise<{ id: number; plate: string } | null>;
  findLoad(id: number): Promise<{ plate: string; vehicleId: number | null } | null>;
  /** The SIESA numbers among `numbers` already held by a line of another load (ignoring load `exceptId`). */
  findTakenSiesa(numbers: string[], exceptId?: number): Promise<string[]>;
  /** The catalog products among `ids`; legacy products (no code) and unknown ids are left out. */
  findCatalogProducts: FindCatalogProducts;
  /** The orders among `ids` that exist, with their lines and the loads that already took part of them. */
  findOrdersForLoad(ids: number[]): Promise<OrderForLoad[]>;
  /** The kilograms per bag in force now. */
  getKgPerBag(): Promise<number>;
  /**
   * Stores the load with its lines. False (nothing stored) when one of `values.orderIds` stopped being
   * available for the supplier meanwhile.
   */
  insertLoad(values: LoadValues): Promise<boolean>;
  /**
   * Updates the load and rewrites its lines in one transaction. "gone" when no load has that id,
   * "orders_unavailable" (nothing changed) when a checked order stopped being available for the supplier.
   */
  updateLoad(id: number, values: LoadValues): Promise<"ok" | "gone" | "orders_unavailable">;
  /** Deletes the load with its lines (its orders go back to what the other loads leave them as). False when no load has that id. */
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
export const ORDERS_UNAVAILABLE = "Algún pedido ya no está disponible: está anulado o ya tiene cargue de este proveedor.";
const NO_ORDERS = "Elige al menos un pedido.";

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
        orderId: l.orderId,
        referenceId: l.referenceId,
        tons: l.tons,
        cost: l.cost,
        siesaNumber: l.siesaNumber,
        orderNumber: l.orderNumber,
      })),
    };
  }

  /**
   * The checked orders must be loadable by the supplier (not annulled, not loaded for it by another load;
   * `loadId` is the load being edited), and every checked order must be covered, to the kilogram.
   */
  async function ensureOrders(values: LoadValues, loadId?: number) {
    if (values.orderIds.length === 0) throw new LoadError(NO_ORDERS);
    const found = await ports.findOrdersForLoad([...values.orderIds]);
    if (unavailableOrderIds(found, values.orderIds, values.supplier, loadId).length > 0) throw new LoadError(ORDERS_UNAVAILABLE);
    const errors = allocationErrors({
      supplier: values.supplier,
      kgPerBag: await ports.getKgPerBag(),
      orders: values.orderIds.flatMap((id) => found.filter((o) => o.id === id)),
      lines: values.lines,
    });
    if (errors.length > 0) throw new LoadError(errors.join("; "));
  }

  return {
    async create(input: LoadInput) {
      const vehicle = await ports.findVehicleByPlate(input.plate);
      if (!vehicle) throw new LoadError(NOT_IN_FLEET);
      await ensureLines(input);
      const values = await prepare(input, { plate: vehicle.plate, vehicleId: vehicle.id });
      await ensureOrders(values);
      if (!(await ports.insertLoad(values))) throw new LoadError(ORDERS_UNAVAILABLE);
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
      const values = await prepare(input, owner);
      await ensureOrders(values, id);
      const result = await ports.updateLoad(id, values);
      if (result === "gone") throw new LoadError(GONE);
      if (result === "orders_unavailable") throw new LoadError(ORDERS_UNAVAILABLE);
    },

    async remove(id: number) {
      if (!(await ports.deleteLoad(id))) throw new LoadError(GONE);
    },
  };
}
