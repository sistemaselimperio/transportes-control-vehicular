import { type FindCatalogProducts, productLabel } from "@/modules/orders/domain/catalog";
import type { OrderStatus } from "@/modules/orders/domain/order-rules";
import { allocationErrors, loadableSuppliers, unavailableOrderIds, type AllocationProduct } from "../domain/load-allocation";
import { balanceBagsError, tripBagsError } from "../domain/load-balance";
import { firstDuplicate, freeRowsError, round3, splitCost } from "../domain/load-lines";
import type { LoadSupplier } from "../domain/load-rules";
import type { BalanceTripInput, CreateLoadsInput, FreeLoadInput, LoadInput } from "./load-schemas";

/** A rule of the loads refused the operation; the message is for the user. */
export class LoadError extends Error {}

/**
 * What the repository stores: the header with the vehicle link and one line per (order, product). The
 * SIESA number and supplier order number repeat on every line of an order; its cost is split across them.
 */
export interface LoadValues extends Omit<LoadInput, "orders"> {
  vehicleId: number | null;
  orderIds: number[];
  /** A free load (no order) has lines with neither an order nor a product. */
  lines: ReadonlyArray<{ orderId: number | null; referenceId: number | null; tons: number; cost: number; siesaNumber: string; orderNumber: string }>;
  /** The bags a truck leaves behind, per order: transport only, with no SIESA, cost or tons. */
  balances: ReadonlyArray<{ orderId: number; bags: number; date: string; plate: string | null; vehicleId: number | null }>;
}

/** The balance of an order of a load as stored. */
export interface StoredBalance {
  orderId: number;
  bags: number;
  plate: string | null;
  vehicleId: number | null;
}

/** A trip of a balance. */
export interface BalanceTripValues {
  balanceId: number;
  date: string;
  plate: string;
  vehicleId: number;
  bags: number;
}

/** The new schedule of the bags a trip leaves behind. */
export interface BalanceReschedule {
  date: string;
  plate: string | null;
  vehicleId: number | null;
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
  /** The load's header and the orders its lines take part of. */
  findLoad(id: number): Promise<{ plate: string; vehicleId: number | null; orderIds: number[] } | null>;
  /** The SIESA numbers among `numbers` already held by a line of another load (ignoring load `exceptId`). */
  findTakenSiesa(numbers: string[], exceptId?: number): Promise<string[]>;
  /** The catalog products among `ids`; legacy products (no code) and unknown ids are left out. */
  findCatalogProducts: FindCatalogProducts;
  /** The orders among `ids` that exist, with their lines and the loads that already took part of them. */
  findOrdersForLoad(ids: number[]): Promise<OrderForLoad[]>;
  /** The kilograms per bag in force now. */
  getKgPerBag(): Promise<number>;
  /**
   * Stores the loads with their lines in one transaction: all or none. False (nothing stored) when an
   * order of one of them stopped being available for its supplier meanwhile; throws a LoadError when a
   * SIESA number was taken meanwhile.
   */
  insertLoads(values: readonly LoadValues[]): Promise<boolean>;
  /**
   * Updates the load and rewrites its lines in one transaction. "gone" when no load has that id,
   * "orders_unavailable" (nothing changed) when a checked order stopped being available for the supplier.
   */
  updateLoad(id: number, values: LoadValues): Promise<"ok" | "gone" | "orders_unavailable">;
  /** Deletes the load with its lines (its orders go back to what the other loads leave them as). False when no load has that id. */
  deleteLoad(id: number): Promise<boolean>;
  /** The balances the load left behind. */
  findLoadBalances(loadId: number): Promise<StoredBalance[]>;
  /** How many trips were registered against the balances of the load. */
  countLoadTrips(loadId: number): Promise<number>;
  /** A balance with the bags its trips already carried; null when gone. */
  findBalance(id: number): Promise<{ id: number; bags: number; carried: number } | null>;
  /**
   * Stores a trip and, when it leaves bags behind, the new schedule of the rest, in one transaction that
   * re-checks the remaining bags: "exceeds" (nothing stored) when the balance changed meanwhile.
   */
  insertBalanceTrip(trip: BalanceTripValues, reschedule: BalanceReschedule | null): Promise<"ok" | "gone" | "exceeds">;
  /** Deletes a trip of a balance; false when no trip has that id. */
  deleteBalanceTrip(id: number): Promise<boolean>;
}

/** Fallback for a race the command's own check did not catch. */
export const SIESA_TAKEN = "Ya existe un cargue con ese número SIESA.";
export const siesaTaken = (siesa: string) => `Ya existe un cargue con el número SIESA ${siesa}.`;
const siesaRepeated = (siesa: string) => `El número SIESA ${siesa} está repetido en el cargue.`;
const supplierRepeated = (supplier: string) => `El proveedor ${supplier} está repetido en el cargue.`;
const GONE = "El cargue ya no existe.";
const PRODUCT_GONE = "Un producto del cargue ya no está en el catálogo.";
const foreignProduct = (label: string, supplier: string) => `El producto ${label} no es del proveedor ${supplier}.`;
const NOT_IN_FLEET = "Elige una placa de la flota.";
export const ORDERS_UNAVAILABLE = "Algún pedido ya no está disponible: está anulado o ya tiene cargue de este proveedor.";
const NO_ORDERS = "Elige al menos un pedido.";
export const NOT_A_FREE_LOAD = "Este cargue pertenece a pedidos; edítalo desde sus pedidos.";
export const BALANCE_TRIPS_REGISTERED = "Este cargue tiene viajes de saldo registrados; bórralos primero.";
const BALANCE_GONE = "El saldo ya no existe.";
const BALANCE_DONE = "Este saldo ya se llevó completo.";
export const BALANCE_CHANGED = "El saldo cambió. Recarga la página e inténtalo de nuevo.";
const NEXT_DATE_MISSING = "Elige la nueva fecha del saldo que queda.";
const TRIP_GONE = "El viaje ya no existe.";
const orderRepeated = (id: number) => `El pedido #${id} está repetido en el cargue.`;
/** The loads must cover exactly what the order has pending right now: anything else means the screen is stale. */
export const ORDERS_CHANGED = "El pedido cambió. Recarga la página e inténtalo de nuevo.";

/** The balances an edit sends are the stored ones: the same orders with the same bags. */
function sameBalances(orders: LoadInput["orders"], stored: readonly StoredBalance[]): boolean {
  const sent = orders.flatMap((o) => (o.balance ? [`${o.orderId}:${o.balance.bags}`] : [])).sort();
  const kept = stored.map((b) => `${b.orderId}:${b.bags}`).sort();
  return sent.length === kept.length && sent.every((v, i) => v === kept[i]);
}

export function createLoadCommands(ports: LoadPorts) {
  /** The SIESA numbers must be distinct inside the submission and not held by another load (`exceptId` is the load being edited). */
  async function ensureFreeSiesa(numbers: readonly string[], exceptId?: number) {
    const repeated = firstDuplicate([...numbers]);
    if (repeated !== null) throw new LoadError(siesaRepeated(repeated));
    const [taken] = await ports.findTakenSiesa([...numbers], exceptId);
    if (taken !== undefined) throw new LoadError(siesaTaken(taken));
  }

  /** The submitted orders must be exactly `expected`, no more and no fewer. */
  function ensureSameOrders(input: LoadInput, expected: readonly number[]) {
    const submitted = input.orders.map((o) => o.orderId);
    if (submitted.length !== expected.length || !expected.every((id) => submitted.includes(id))) throw new LoadError(ORDERS_CHANGED);
  }

  /** The vehicle a load is made for: a fleet vehicle, or (on an edit) the stored plate of one that left the fleet. */
  async function ownerOf(plate: string, stored?: { plate: string; vehicleId: number | null }) {
    const vehicle = await ports.findVehicleByPlate(plate);
    if (vehicle) return { plate: vehicle.plate, vehicleId: vehicle.id };
    // The vehicle left the fleet since: the load keeps the plate and link it was saved with.
    if (stored && stored.plate === plate) return { plate, vehicleId: stored.vehicleId };
    throw new LoadError(NOT_IN_FLEET);
  }

  /** A plate picked for a balance or a trip: a fleet vehicle, or the plate its stored balance already had. */
  async function fleetPlate(plate: string, stored?: { plate: string | null; vehicleId: number | null }) {
    const vehicle = await ports.findVehicleByPlate(plate);
    if (vehicle) return { plate: vehicle.plate, vehicleId: vehicle.id };
    if (stored && stored.plate === plate) return { plate, vehicleId: stored.vehicleId };
    throw new LoadError(NOT_IN_FLEET);
  }

  /** The balances of a load's orders: the bags left must be below the order's bags for the supplier. */
  async function balancesOf(
    orders: ReadonlyArray<Pick<LoadInput["orders"][number], "orderId" | "balance">>,
    found: readonly OrderForLoad[],
    supplier: LoadSupplier,
    stored: readonly StoredBalance[] = [],
  ): Promise<LoadValues["balances"]> {
    const balances: Array<LoadValues["balances"][number]> = [];
    for (const o of orders) {
      if (!o.balance) continue;
      const lines = found.find((f) => f.id === o.orderId)?.lines ?? [];
      const orderBags = lines.filter((l) => l.supplier === supplier).reduce((sum, l) => sum + l.bags, 0);
      const bagsError = balanceBagsError(o.balance.bags, orderBags);
      if (bagsError) throw new LoadError(`Pedido #${o.orderId}: ${bagsError}`);
      const owner = o.balance.plate === null ? null : await fleetPlate(o.balance.plate, stored.find((s) => s.orderId === o.orderId));
      balances.push({ orderId: o.orderId, bags: o.balance.bags, date: o.balance.date, plate: owner?.plate ?? null, vehicleId: owner?.vehicleId ?? null });
    }
    return balances;
  }

  /** Every product must be a catalog product of the load's supplier; run once every other check passed. */
  async function prepare(
    header: Pick<LoadValues, "date" | "supplier" | "notes">,
    orders: LoadInput["orders"],
    owner: { plate: string; vehicleId: number | null },
  ): Promise<LoadValues> {
    const wanted = [...new Set(orders.flatMap((o) => o.lines.map((l) => l.referenceId)))];
    const products = new Map((await ports.findCatalogProducts(wanted)).map((p) => [p.id, p]));
    for (const id of wanted) {
      const product = products.get(id);
      if (!product) throw new LoadError(PRODUCT_GONE);
      if (product.supplier !== header.supplier) throw new LoadError(foreignProduct(productLabel(product), header.supplier));
    }
    return {
      ...header,
      plate: owner.plate,
      vehicleId: owner.vehicleId,
      orderIds: orders.map((o) => o.orderId),
      balances: [],
      lines: orders.flatMap((o) => {
        const costs = splitCost(
          o.cost,
          o.lines.map((l) => l.tons),
        );
        return o.lines.map((l, i) => ({
          orderId: o.orderId,
          referenceId: l.referenceId,
          tons: l.tons,
          cost: costs[i] ?? 0,
          siesaNumber: o.siesaNumber,
          orderNumber: o.orderNumber,
        }));
      }),
    };
  }

  /** The tons of every product of the load's orders against what was ordered, to the kilogram: one message per violation. */
  const allocationProblems = (values: LoadValues, found: readonly OrderForLoad[], kgPerBag: number): string[] =>
    allocationErrors({
      supplier: values.supplier,
      kgPerBag,
      orders: values.orderIds.flatMap((id) => found.filter((o) => o.id === id)),
      // Only the lines of an order load reach the allocation: a free load has no order to cover.
      lines: values.lines.flatMap((l) => (l.orderId === null || l.referenceId === null ? [] : [{ ...l, orderId: l.orderId, referenceId: l.referenceId }])),
    });

  /** A free load: no order, no products; the tons are the kilos over a thousand and the cost is the value as typed. */
  function freeValues(input: FreeLoadInput, owner: { plate: string; vehicleId: number | null }): LoadValues {
    return {
      date: input.date,
      supplier: input.supplier,
      notes: input.notes,
      plate: owner.plate,
      vehicleId: owner.vehicleId,
      orderIds: [],
      balances: [],
      lines: input.rows.map((r) => ({
        orderId: null,
        referenceId: null,
        tons: round3(r.kg / 1000),
        cost: r.cost,
        siesaNumber: r.siesaNumber,
        orderNumber: r.orderNumber,
      })),
    };
  }

  /** The rows must be complete and their SIESA numbers free (`exceptId` is the load being edited). */
  async function ensureFreeRows(input: FreeLoadInput, exceptId?: number) {
    const problem = freeRowsError(input.rows);
    if (problem !== null) throw new LoadError(problem);
    await ensureFreeSiesa(
      input.rows.map((r) => r.siesaNumber),
      exceptId,
    );
  }

  return {
    /** A load made without an order, with one line per SIESA row. */
    async createFree(input: FreeLoadInput) {
      const owner = await ownerOf(input.plate);
      await ensureFreeRows(input);
      if (!(await ports.insertLoads([freeValues(input, owner)]))) throw new LoadError(ORDERS_CHANGED);
    },

    /** Edits a free load: its lines are rewritten whole. A load that takes orders cannot be edited here. */
    async updateFree(id: number, input: FreeLoadInput) {
      const stored = await ports.findLoad(id);
      if (!stored) throw new LoadError(GONE);
      if (stored.orderIds.length > 0) throw new LoadError(NOT_A_FREE_LOAD);
      const owner = await ownerOf(input.plate, stored);
      await ensureFreeRows(input, id);
      const result = await ports.updateLoad(id, freeValues(input, owner));
      if (result === "gone") throw new LoadError(GONE);
      if (result === "orders_unavailable") throw new LoadError(ORDERS_CHANGED);
    },

    /**
     * The loads of one order: one per supplier pending in it, saved all together or not at all. The
     * submission must cover exactly the suppliers pending right now.
     */
    async createForOrder(input: CreateLoadsInput) {
      const owner = await ownerOf(input.plate);
      const suppliers = input.blocks.map((b) => b.supplier);
      const twice = suppliers.find((s, i) => suppliers.indexOf(s) !== i);
      if (twice !== undefined) throw new LoadError(supplierRepeated(twice));
      await ensureFreeSiesa(input.blocks.map((b) => b.siesaNumber));

      const [order] = await ports.findOrdersForLoad([input.orderId]);
      if (!order || order.status === "anulado") throw new LoadError(ORDERS_UNAVAILABLE);
      const pending = loadableSuppliers(order);
      if (pending.length !== suppliers.length || !pending.every((s) => suppliers.includes(s))) throw new LoadError(ORDERS_CHANGED);

      const values: LoadValues[] = [];
      for (const { supplier, ...block } of input.blocks) {
        values.push(await prepare({ date: input.date, supplier, notes: input.notes }, [{ orderId: input.orderId, ...block }], owner));
      }
      const kgPerBag = await ports.getKgPerBag();
      const problems = values.flatMap((v) => allocationProblems(v, [order], kgPerBag));
      if (problems.length > 0) throw new LoadError(problems.join("; "));
      const withBalances: LoadValues[] = [];
      for (const [i, v] of values.entries()) {
        const balance = input.blocks[i]?.balance;
        withBalances.push({ ...v, balances: await balancesOf([{ orderId: input.orderId, balance }], [order], v.supplier) });
      }
      if (!(await ports.insertLoads(withBalances))) throw new LoadError(ORDERS_CHANGED);
    },

    async update(id: number, input: LoadInput) {
      const stored = await ports.findLoad(id);
      if (!stored) throw new LoadError(GONE);
      const owner = await ownerOf(input.plate, stored);
      if (input.orders.length === 0) throw new LoadError(NO_ORDERS);
      const ids = input.orders.map((o) => o.orderId);
      const repeatedOrder = ids.find((orderId, i) => ids.indexOf(orderId) !== i);
      if (repeatedOrder !== undefined) throw new LoadError(orderRepeated(repeatedOrder));
      await ensureFreeSiesa(
        input.orders.map((o) => o.siesaNumber),
        id,
      );
      // An edit keeps the orders the load already took: it neither takes new ones nor lets go of any.
      ensureSameOrders(input, stored.orderIds);
      // With trips registered the balances are frozen: the edit may only resend them as they are.
      const storedBalances = await ports.findLoadBalances(id);
      if ((await ports.countLoadTrips(id)) > 0 && !sameBalances(input.orders, storedBalances)) throw new LoadError(BALANCE_TRIPS_REGISTERED);
      const values = await prepare({ date: input.date, supplier: input.supplier, notes: input.notes }, input.orders, owner);
      // The orders must still be loadable by the supplier (`id` is the load being edited) and covered to the kilogram.
      const found = await ports.findOrdersForLoad([...values.orderIds]);
      if (unavailableOrderIds(found, values.orderIds, values.supplier, id).length > 0) throw new LoadError(ORDERS_UNAVAILABLE);
      const problems = allocationProblems(values, found, await ports.getKgPerBag());
      if (problems.length > 0) throw new LoadError(problems.join("; "));
      const balances = await balancesOf(input.orders, found, values.supplier, storedBalances);
      const result = await ports.updateLoad(id, { ...values, balances });
      if (result === "gone") throw new LoadError(GONE);
      if (result === "orders_unavailable") throw new LoadError(ORDERS_UNAVAILABLE);
    },

    async remove(id: number) {
      if ((await ports.countLoadTrips(id)) > 0) throw new LoadError(BALANCE_TRIPS_REGISTERED);
      // A delivered order must keep the load that carried it: its delivery is undone first.
      const stored = await ports.findLoad(id);
      if (stored && stored.orderIds.length > 0) {
        const delivered = (await ports.findOrdersForLoad(stored.orderIds)).filter((o) => o.status === "entregado").map((o) => `#${o.id}`);
        if (delivered.length > 0) throw new LoadError(`El cargue tiene pedidos entregados (${delivered.join(", ")}): deshaz la entrega antes de eliminarlo.`);
      }
      if (!(await ports.deleteLoad(id))) throw new LoadError(GONE);
    },

    /**
     * A trip that carries part (or all) of a balance. When it leaves bags behind, the new date (and optional
     * plate) of the rest is required.
     */
    async registerBalanceTrip(balanceId: number, input: BalanceTripInput) {
      const balance = await ports.findBalance(balanceId);
      if (!balance) throw new LoadError(BALANCE_GONE);
      const remaining = balance.bags - balance.carried;
      if (remaining <= 0) throw new LoadError(BALANCE_DONE);
      const bagsError = tripBagsError(input.bags, remaining);
      if (bagsError) throw new LoadError(bagsError);
      const vehicle = await fleetPlate(input.plate);
      let reschedule: BalanceReschedule | null = null;
      if (input.bags < remaining) {
        if (input.nextDate === null) throw new LoadError(NEXT_DATE_MISSING);
        const next = input.nextPlate === null ? null : await fleetPlate(input.nextPlate);
        reschedule = { date: input.nextDate, plate: next?.plate ?? null, vehicleId: next?.vehicleId ?? null };
      }
      const result = await ports.insertBalanceTrip(
        { balanceId, date: input.date, plate: vehicle.plate, vehicleId: vehicle.vehicleId as number, bags: input.bags },
        reschedule,
      );
      if (result === "gone") throw new LoadError(BALANCE_GONE);
      if (result === "exceeds") throw new LoadError(BALANCE_CHANGED);
    },

    async removeBalanceTrip(id: number) {
      if (!(await ports.deleteBalanceTrip(id))) throw new LoadError(TRIP_GONE);
    },
  };
}
