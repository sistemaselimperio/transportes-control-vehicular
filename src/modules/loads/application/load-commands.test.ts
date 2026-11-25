import { describe, expect, it, vi } from "vitest";
import { createLoadCommands, LoadError, ORDERS_CHANGED, type LoadPorts, type OrderForLoad } from "./load-commands";
import type { BalanceTripInput, CreateLoadsInput, LoadInput } from "./load-schemas";

// Order 12 asks for 750 Finca bags of product 10: at 40 kg per bag that is exactly 30 t.
const block = { orderId: 12, siesaNumber: "FV-100", orderNumber: "P-77", cost: 1_500_000, lines: [{ referenceId: 10, tons: 30 }] };

/** An edit of one load: one supplier, its orders. */
const input = (over: Partial<LoadInput> = {}): LoadInput => ({
  date: "2026-11-18",
  supplier: "Finca",
  plate: "ABC-123",
  notes: null,
  orders: [block],
  ...over,
});

const fincaBlock = { supplier: "Finca" as const, siesaNumber: "FV-100", orderNumber: "P-77", cost: 1_500_000, lines: [{ referenceId: 10, tons: 30 }] };
// Product 20 is Contegral's: 250 bags x 40 kg = 10 t.
const contegralBlock = { supplier: "Contegral" as const, siesaNumber: "CT-200", orderNumber: "P-90", cost: 600_000, lines: [{ referenceId: 20, tons: 10 }] };

/** The loads of order 12, one per supplier block. */
const create = (over: Partial<CreateLoadsInput> = {}): CreateLoadsInput => ({
  date: "2026-11-18",
  orderId: 12,
  plate: "ABC-123",
  notes: null,
  blocks: [fincaBlock],
  ...over,
});

const storedLine = { orderId: 12, referenceId: 10, tons: 30, cost: 1_500_000, siesaNumber: "FV-100", orderNumber: "P-77" };

const finca = { referenceId: 10, label: "C10 · Producto 10", supplier: "Finca" as const, bags: 750 };
const contegral = { referenceId: 20, label: "C20 · Producto 20", supplier: "Contegral" as const, bags: 250 };

const order = (over: Partial<OrderForLoad> = {}): OrderForLoad => ({
  id: 12,
  status: "pendiente",
  loads: [],
  lines: [finca],
  ...over,
});

const mixedOrder = (over: Partial<OrderForLoad> = {}) => order({ lines: [finca, contegral], ...over });

function ports(over: Partial<LoadPorts> = {}): LoadPorts {
  return {
    findVehicleByPlate: vi.fn(async (plate: string) => (plate === "ABC-123" ? { id: 9, plate: "ABC-123" } : null)),
    findLoad: vi.fn(async () => ({ plate: "ABC-123", vehicleId: 9, orderIds: [12] })),
    findTakenSiesa: vi.fn(async () => []),
    // Ids 10-19 are Finca products; 20-29 are Contegral's; every other id is not in the catalog.
    findCatalogProducts: vi.fn(async (ids: number[]) =>
      ids.flatMap((id) =>
        id >= 10 && id < 30
          ? [{ id, code: `C${id}`, name: `Producto ${id}`, supplier: id < 20 ? ("Finca" as const) : ("Contegral" as const) }]
          : [],
      ),
    ),
    findOrdersForLoad: vi.fn(async () => [order()]),
    getKgPerBag: vi.fn(async () => 40),
    insertLoads: vi.fn(async () => true),
    updateLoad: vi.fn(async () => "ok" as const),
    deleteLoad: vi.fn(async () => true),
    findLoadBalances: vi.fn(async () => []),
    countLoadTrips: vi.fn(async () => 0),
    findBalance: vi.fn(async () => ({ id: 1, bags: 5, carried: 0 })),
    insertBalanceTrip: vi.fn(async () => "ok" as const),
    deleteBalanceTrip: vi.fn(async () => true),
    ...over,
  };
}

const withProduct = (referenceId: number) => ({ ...fincaBlock, lines: [{ referenceId, tons: 30 }] });

describe("createForOrder", () => {
  it("stores the fleet plate, links the vehicle and checks the catalog products", async () => {
    const p = ports();
    await createLoadCommands(p).createForOrder(create());
    expect(p.findCatalogProducts).toHaveBeenCalledWith([10]);
    expect(p.insertLoads).toHaveBeenCalledWith([
      { date: "2026-11-18", supplier: "Finca", plate: "ABC-123", vehicleId: 9, notes: null, orderIds: [12], lines: [storedLine], balances: [] },
    ]);
  });

  it("makes one load per supplier block with the same date, plate and notes, in a single insert", async () => {
    const p = ports({ findOrdersForLoad: vi.fn(async () => [mixedOrder()]) });
    await createLoadCommands(p).createForOrder(create({ notes: "Cuidado", blocks: [fincaBlock, contegralBlock] }));
    expect(p.insertLoads).toHaveBeenCalledTimes(1);
    expect(p.insertLoads).toHaveBeenCalledWith([
      { date: "2026-11-18", supplier: "Finca", plate: "ABC-123", vehicleId: 9, notes: "Cuidado", orderIds: [12], lines: [storedLine], balances: [] },
      {
        date: "2026-11-18",
        supplier: "Contegral",
        plate: "ABC-123",
        vehicleId: 9,
        notes: "Cuidado",
        orderIds: [12],
        lines: [{ orderId: 12, referenceId: 20, tons: 10, cost: 600_000, siesaNumber: "CT-200", orderNumber: "P-90" }],
        balances: [],
      },
    ]);
    expect(p.findOrdersForLoad).toHaveBeenCalledWith([12]);
  });

  it("splits the cost of a block across its products by tons and repeats the SIESA and supplier order on each line", async () => {
    const two = order({ lines: [finca, { referenceId: 11, label: "C11 · Producto 11", supplier: "Finca", bags: 250 }] });
    const p = ports({ findOrdersForLoad: vi.fn(async () => [two]) });
    await createLoadCommands(p).createForOrder(
      create({
        blocks: [
          {
            ...fincaBlock,
            cost: 1_000_001,
            lines: [
              { referenceId: 10, tons: 30 },
              { referenceId: 11, tons: 10 },
            ],
          },
        ],
      }),
    );
    expect(p.findCatalogProducts).toHaveBeenCalledWith([10, 11]);
    const stored = vi.mocked(p.insertLoads).mock.calls[0]?.[0][0]?.lines;
    expect(stored).toEqual([
      { orderId: 12, referenceId: 10, tons: 30, cost: 750_000, siesaNumber: "FV-100", orderNumber: "P-77" },
      { orderId: 12, referenceId: 11, tons: 10, cost: 250_001, siesaNumber: "FV-100", orderNumber: "P-77" },
    ]);
    expect(stored?.reduce((sum, l) => sum + l.cost, 0)).toBe(1_000_001);
  });

  it("refuses a product that is not in the catalog or belongs to another supplier", async () => {
    const p = ports();
    await expect(createLoadCommands(p).createForOrder(create({ blocks: [withProduct(99)] }))).rejects.toThrow(
      "Un producto del cargue ya no está en el catálogo.",
    );
    await expect(createLoadCommands(p).createForOrder(create({ blocks: [withProduct(21)] }))).rejects.toThrow(
      "El producto C21 · Producto 21 no es del proveedor Finca.",
    );
    expect(p.insertLoads).not.toHaveBeenCalled();
  });

  it("refuses a plate outside the fleet", async () => {
    const p = ports();
    await expect(createLoadCommands(p).createForOrder(create({ plate: "ZZZ-999" }))).rejects.toThrow("Elige una placa de la flota.");
    expect(p.insertLoads).not.toHaveBeenCalled();
  });

  it("names the SIESA number already used by another load", async () => {
    const p = ports({ findTakenSiesa: vi.fn(async () => ["FV-100"]) });
    await expect(createLoadCommands(p).createForOrder(create())).rejects.toThrow("Ya existe un cargue con el número SIESA FV-100.");
    expect(p.findTakenSiesa).toHaveBeenCalledWith(["FV-100"], undefined);
    expect(p.findCatalogProducts).not.toHaveBeenCalled();
    expect(p.insertLoads).not.toHaveBeenCalled();
  });

  it("refuses the same SIESA number on two blocks and a supplier sent twice", async () => {
    const p = ports({ findOrdersForLoad: vi.fn(async () => [mixedOrder()]) });
    await expect(
      createLoadCommands(p).createForOrder(create({ blocks: [fincaBlock, { ...contegralBlock, siesaNumber: "FV-100" }] })),
    ).rejects.toThrow("El número SIESA FV-100 está repetido en el cargue.");
    await expect(createLoadCommands(p).createForOrder(create({ blocks: [fincaBlock, { ...fincaBlock, siesaNumber: "FV-101" }] }))).rejects.toThrow(
      "El proveedor Finca está repetido en el cargue.",
    );
    expect(p.insertLoads).not.toHaveBeenCalled();
  });

  it("allows repeating the supplier order number across the blocks", async () => {
    const p = ports({ findOrdersForLoad: vi.fn(async () => [mixedOrder()]) });
    await createLoadCommands(p).createForOrder(create({ blocks: [fincaBlock, { ...contegralBlock, orderNumber: fincaBlock.orderNumber }] }));
    expect(p.insertLoads).toHaveBeenCalledTimes(1);
  });
});

describe("the loads cover exactly what the order has pending", () => {
  it("refuses a submission that leaves a pending supplier out, asking to reload", async () => {
    const p = ports({ findOrdersForLoad: vi.fn(async () => [mixedOrder()]) });
    await expect(createLoadCommands(p).createForOrder(create({ blocks: [fincaBlock] }))).rejects.toThrow(ORDERS_CHANGED);
    expect(p.insertLoads).not.toHaveBeenCalled();
  });

  it("refuses a block of a supplier that is not pending, such as one loaded meanwhile", async () => {
    const loaded = ports({
      findOrdersForLoad: vi.fn(async () => [mixedOrder({ loads: [{ loadId: 8, supplier: "Finca" }] })]),
    });
    await expect(createLoadCommands(loaded).createForOrder(create({ blocks: [fincaBlock, contegralBlock] }))).rejects.toThrow(ORDERS_CHANGED);
    const absent = ports();
    await expect(createLoadCommands(absent).createForOrder(create({ blocks: [fincaBlock, contegralBlock] }))).rejects.toThrow(ORDERS_CHANGED);
    expect(loaded.insertLoads).not.toHaveBeenCalled();
    expect(absent.insertLoads).not.toHaveBeenCalled();
  });

  it("takes only the pending part of a partly loaded order", async () => {
    const p = ports({ findOrdersForLoad: vi.fn(async () => [mixedOrder({ loads: [{ loadId: 8, supplier: "Finca" }] })]) });
    await createLoadCommands(p).createForOrder(create({ blocks: [contegralBlock] }));
    expect(p.insertLoads).toHaveBeenCalledTimes(1);
  });

  it("refuses an annulled or missing order and a fully loaded one", async () => {
    const annulled = ports({ findOrdersForLoad: vi.fn(async () => [order({ status: "anulado" })]) });
    await expect(createLoadCommands(annulled).createForOrder(create())).rejects.toThrow("Algún pedido ya no está disponible");
    const missing = ports({ findOrdersForLoad: vi.fn(async () => []) });
    await expect(createLoadCommands(missing).createForOrder(create())).rejects.toThrow(LoadError);
    const loaded = ports({ findOrdersForLoad: vi.fn(async () => [order({ status: "cargado", loads: [{ loadId: 8, supplier: "Finca" }] })]) });
    await expect(createLoadCommands(loaded).createForOrder(create())).rejects.toThrow(ORDERS_CHANGED);
    expect(annulled.insertLoads).not.toHaveBeenCalled();
  });

  it("reports a supplier that was taken between the check and the write", async () => {
    const p = ports({ insertLoads: vi.fn(async () => false) });
    await expect(createLoadCommands(p).createForOrder(create())).rejects.toThrow(ORDERS_CHANGED);
  });
});

describe("tons against the order", () => {
  it("blocks a load short of the ordered weight, naming the order, the product and the kilos", async () => {
    const p = ports();
    await expect(
      createLoadCommands(p).createForOrder(create({ blocks: [{ ...fincaBlock, lines: [{ referenceId: 10, tons: 29.95 }] }] })),
    ).rejects.toThrow("Pedido #12 · C10 · Producto 10: faltan 50 kg");
    expect(p.insertLoads).not.toHaveBeenCalled();
  });

  it("blocks a load over the ordered weight", async () => {
    const p = ports();
    await expect(createLoadCommands(p).update(4, input({ orders: [{ ...block, lines: [{ referenceId: 10, tons: 30.001 }] }] }))).rejects.toThrow("sobra 1 kg");
    expect(p.updateLoad).not.toHaveBeenCalled();
  });

  it("uses the kg per bag in force now", async () => {
    const p = ports({ getKgPerBag: vi.fn(async () => 45) });
    await expect(createLoadCommands(p).createForOrder(create())).rejects.toThrow("faltan 3.750 kg");
    expect(p.getKgPerBag).toHaveBeenCalled();
  });

  it("reports every violation of every block at once and stores nothing", async () => {
    const p = ports({ findOrdersForLoad: vi.fn(async () => [mixedOrder()]) });
    await expect(
      createLoadCommands(p).createForOrder(
        create({
          blocks: [
            { ...fincaBlock, lines: [{ referenceId: 10, tons: 29 }] },
            { ...contegralBlock, lines: [{ referenceId: 20, tons: 9 }] },
          ],
        }),
      ),
    ).rejects.toThrow("Pedido #12 · C10 · Producto 10: faltan 1.000 kg; Pedido #12 · C20 · Producto 20: faltan 1.000 kg");
    expect(p.insertLoads).not.toHaveBeenCalled();
  });

  it("blocks a product the order does not ask of the supplier", async () => {
    const p = ports({
      findOrdersForLoad: vi.fn(async () => [order()]),
    });
    await expect(
      createLoadCommands(p).createForOrder(
        create({
          blocks: [
            {
              ...fincaBlock,
              lines: [
                { referenceId: 10, tons: 30 },
                { referenceId: 11, tons: 1 },
              ],
            },
          ],
        }),
      ),
    ).rejects.toThrow("no es del pedido para Finca");
  });
});

describe("update", () => {
  it("ignores its own SIESA numbers", async () => {
    const p = ports();
    await createLoadCommands(p).update(3, input());
    expect(p.findTakenSiesa).toHaveBeenCalledWith(["FV-100"], 3);
    expect(p.updateLoad).toHaveBeenCalledWith(3, expect.objectContaining({ plate: "ABC-123", vehicleId: 9, lines: [storedLine] }));
  });

  it("refuses a line whose product is of another supplier or was left outside the catalog", async () => {
    const p = ports();
    await expect(createLoadCommands(p).update(3, input({ supplier: "Contegral" }))).rejects.toThrow(
      "El producto C10 · Producto 10 no es del proveedor Contegral.",
    );
    await expect(createLoadCommands(p).update(3, input({ orders: [{ ...block, lines: [{ referenceId: 5, tons: 30 }] }] }))).rejects.toThrow(
      "Un producto del cargue ya no está en el catálogo.",
    );
    expect(p.updateLoad).not.toHaveBeenCalled();
  });

  it("refuses a SIESA number held by another load, and one used by two orders of the load", async () => {
    const taken = ports({ findTakenSiesa: vi.fn(async () => ["FV-100"]) });
    await expect(createLoadCommands(taken).update(3, input())).rejects.toThrow(LoadError);
    const twice = ports({ findLoad: vi.fn(async () => ({ plate: "ABC-123", vehicleId: 9, orderIds: [12, 13] })) });
    await expect(createLoadCommands(twice).update(3, input({ orders: [block, { ...block, orderId: 13 }] }))).rejects.toThrow(
      "El número SIESA FV-100 está repetido en el cargue.",
    );
  });

  it("refuses an order sent twice and an empty load", async () => {
    const p = ports();
    await expect(createLoadCommands(p).update(3, input({ orders: [block, { ...block, siesaNumber: "FV-101" }] }))).rejects.toThrow(
      "El pedido #12 está repetido en el cargue.",
    );
    await expect(createLoadCommands(p).update(3, input({ orders: [] }))).rejects.toThrow("Elige al menos un pedido.");
  });

  it("keeps the orders the load already took: neither new ones nor fewer", async () => {
    const more = ports();
    await expect(createLoadCommands(more).update(3, input({ orders: [block, { ...block, orderId: 13, siesaNumber: "FV-101" }] }))).rejects.toThrow(
      ORDERS_CHANGED,
    );
    const fewer = ports({ findLoad: vi.fn(async () => ({ plate: "ABC-123", vehicleId: 9, orderIds: [12, 13] })) });
    await expect(createLoadCommands(fewer).update(3, input())).rejects.toThrow(ORDERS_CHANGED);
    expect(more.updateLoad).not.toHaveBeenCalled();
    expect(fewer.updateLoad).not.toHaveBeenCalled();
  });

  it("allows an old load that carries several orders, repeating the supplier order number", async () => {
    const p = ports({
      findLoad: vi.fn(async () => ({ plate: "ABC-123", vehicleId: 9, orderIds: [12, 13] })),
      findOrdersForLoad: vi.fn(async () => [order(), order({ id: 13 })]),
    });
    await createLoadCommands(p).update(3, input({ orders: [block, { ...block, orderId: 13, siesaNumber: "FV-101" }] }));
    expect(p.updateLoad).toHaveBeenCalledWith(3, expect.objectContaining({ orderIds: [12, 13] }));
  });

  it("keeps the stored plate when its vehicle left the fleet and the plate is unchanged", async () => {
    const p = ports({ findLoad: vi.fn(async () => ({ plate: "OLD-111", vehicleId: null, orderIds: [12] })) });
    await createLoadCommands(p).update(3, input({ plate: "OLD-111" }));
    expect(p.updateLoad).toHaveBeenCalledWith(3, expect.objectContaining({ plate: "OLD-111", vehicleId: null }));
  });

  it("refuses a different plate outside the fleet", async () => {
    const p = ports({ findLoad: vi.fn(async () => ({ plate: "OLD-111", vehicleId: null, orderIds: [12] })) });
    await expect(createLoadCommands(p).update(3, input({ plate: "ZZZ-999" }))).rejects.toThrow("Elige una placa de la flota.");
  });

  it("says when the load is gone", async () => {
    await expect(createLoadCommands(ports({ findLoad: vi.fn(async () => null) })).update(3, input())).rejects.toThrow(
      "El cargue ya no existe.",
    );
    await expect(createLoadCommands(ports({ updateLoad: vi.fn(async () => "gone" as const) })).update(3, input())).rejects.toThrow(
      "El cargue ya no existe.",
    );
  });

  it("refuses an order whose part of this supplier is already in another load", async () => {
    const p = ports({ findOrdersForLoad: vi.fn(async () => [order({ loads: [{ loadId: 8, supplier: "Finca" }] })]) });
    await expect(createLoadCommands(p).update(4, input())).rejects.toThrow(LoadError);
    expect(p.updateLoad).not.toHaveBeenCalled();
  });

  it("keeps the part of an order that already belongs to the load being edited", async () => {
    const p = ports({ findOrdersForLoad: vi.fn(async () => [order({ status: "cargado", loads: [{ loadId: 4, supplier: "Finca" }] })]) });
    await createLoadCommands(p).update(4, input());
    expect(p.updateLoad).toHaveBeenCalledWith(4, expect.objectContaining({ orderIds: [12] }));
  });

  it("reports an order that was taken between the check and the write", async () => {
    const updated = ports({ updateLoad: vi.fn(async () => "orders_unavailable" as const) });
    await expect(createLoadCommands(updated).update(4, input())).rejects.toThrow("Algún pedido ya no está disponible");
  });
});

describe("remove", () => {
  it("deletes and reports a missing load", async () => {
    const p = ports();
    await createLoadCommands(p).remove(3);
    expect(p.deleteLoad).toHaveBeenCalledWith(3);
    await expect(createLoadCommands(ports({ deleteLoad: vi.fn(async () => false) })).remove(3)).rejects.toThrow(
      "El cargue ya no existe.",
    );
  });
});

describe("a load that leaves bags behind", () => {
  // Order 12 asks for 750 Finca bags: 5 of them stay for a later trip.
  const balance = { bags: 5, date: "2026-11-25", plate: null };
  const withBalance = (over: Partial<NonNullable<LoadInput["orders"][number]["balance"]>> = {}) => ({ ...fincaBlock, balance: { ...balance, ...over } });

  it("stores the balance with the load; the load still records the whole purchase", async () => {
    const p = ports();
    await createLoadCommands(p).createForOrder(create({ blocks: [withBalance()] }));
    const [stored] = vi.mocked(p.insertLoads).mock.calls[0]?.[0] ?? [];
    expect(stored?.balances).toEqual([{ orderId: 12, bags: 5, date: "2026-11-25", plate: null, vehicleId: null }]);
    expect(stored?.lines).toEqual([storedLine]);
  });

  it("links the plate of the balance to its fleet vehicle", async () => {
    const p = ports();
    await createLoadCommands(p).createForOrder(create({ blocks: [withBalance({ plate: "ABC-123" })] }));
    expect(vi.mocked(p.insertLoads).mock.calls[0]?.[0][0]?.balances).toEqual([
      { orderId: 12, bags: 5, date: "2026-11-25", plate: "ABC-123", vehicleId: 9 },
    ]);
  });

  it("refuses a plate of the balance outside the fleet", async () => {
    const p = ports();
    await expect(createLoadCommands(p).createForOrder(create({ blocks: [withBalance({ plate: "ZZZ-999" })] }))).rejects.toThrow(
      "Elige una placa de la flota.",
    );
    expect(p.insertLoads).not.toHaveBeenCalled();
  });

  it("refuses leftover bags that are not below the bags of the order for the supplier", async () => {
    const p = ports();
    await expect(createLoadCommands(p).createForOrder(create({ blocks: [withBalance({ bags: 750 })] }))).rejects.toThrow(
      "Pedido #12: Los bultos que se quedan deben ser un número entero mayor que cero y menor que los 750 bultos del pedido.",
    );
    expect(p.insertLoads).not.toHaveBeenCalled();
  });

  it("measures the leftover against the bags of the load's supplier only", async () => {
    const p = ports({ findOrdersForLoad: vi.fn(async () => [mixedOrder()]) });
    // Contegral has 250 bags in this order: 250 left behind is the whole part, 249 is fine.
    await expect(
      createLoadCommands(p).createForOrder(create({ blocks: [fincaBlock, { ...contegralBlock, balance: { ...balance, bags: 250 } }] })),
    ).rejects.toThrow("menor que los 250 bultos del pedido");
    await createLoadCommands(p).createForOrder(create({ blocks: [fincaBlock, { ...contegralBlock, balance: { ...balance, bags: 249 } }] }));
    expect(p.insertLoads).toHaveBeenCalledTimes(1);
  });

  it("does not skip the kilogram check: the tons still cover every bag", async () => {
    const p = ports();
    await expect(
      createLoadCommands(p).createForOrder(create({ blocks: [{ ...withBalance(), lines: [{ referenceId: 10, tons: 29.8 }] }] })),
    ).rejects.toThrow("faltan 200 kg");
  });

  it("stores the balance of an edited order", async () => {
    const p = ports();
    await createLoadCommands(p).update(3, input({ orders: [{ ...block, balance }] }));
    expect(p.updateLoad).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ balances: [{ orderId: 12, bags: 5, date: "2026-11-25", plate: null, vehicleId: null }] }),
    );
  });

  it("keeps the stored plate of a balance whose vehicle left the fleet", async () => {
    const p = ports({ findLoadBalances: vi.fn(async () => [{ orderId: 12, bags: 5, plate: "OLD-111", vehicleId: null }]) });
    await createLoadCommands(p).update(3, input({ orders: [{ ...block, balance: { ...balance, plate: "OLD-111" } }] }));
    expect(p.updateLoad).toHaveBeenCalledWith(3, expect.objectContaining({ balances: [expect.objectContaining({ plate: "OLD-111", vehicleId: null })] }));
  });

  it("clears the balance of an edit that unchecks it, when no trip was registered", async () => {
    const p = ports({ findLoadBalances: vi.fn(async () => [{ orderId: 12, bags: 5, plate: null, vehicleId: null }]) });
    await createLoadCommands(p).update(3, input());
    expect(p.updateLoad).toHaveBeenCalledWith(3, expect.objectContaining({ balances: [] }));
  });
});

describe("a balance with trips registered", () => {
  const TRIPS = "Este cargue tiene viajes de saldo registrados; bórralos primero.";
  const stored = [{ orderId: 12, bags: 5, plate: null, vehicleId: null }];
  const locked = () => ports({ countLoadTrips: vi.fn(async () => 1), findLoadBalances: vi.fn(async () => stored) });
  const same = { bags: 5, date: "2026-12-01", plate: null };

  it("cannot be unchecked or change its bags", async () => {
    const p = locked();
    await expect(createLoadCommands(p).update(3, input())).rejects.toThrow(TRIPS);
    await expect(createLoadCommands(p).update(3, input({ orders: [{ ...block, balance: { ...same, bags: 4 } }] }))).rejects.toThrow(TRIPS);
    expect(p.updateLoad).not.toHaveBeenCalled();
  });

  it("cannot get a balance on another order either", async () => {
    const p = ports({
      countLoadTrips: vi.fn(async () => 1),
      findLoadBalances: vi.fn(async () => stored),
      findLoad: vi.fn(async () => ({ plate: "ABC-123", vehicleId: 9, orderIds: [12, 13] })),
      findOrdersForLoad: vi.fn(async () => [order(), order({ id: 13 })]),
    });
    const other = { ...block, orderId: 13, siesaNumber: "FV-101", balance: same };
    await expect(createLoadCommands(p).update(3, input({ orders: [{ ...block, balance: same }, other] }))).rejects.toThrow(TRIPS);
  });

  it("still lets the rest of the load change while the balance stays as it is", async () => {
    const p = locked();
    await createLoadCommands(p).update(3, input({ notes: "Nota", orders: [{ ...block, balance: same }] }));
    expect(p.updateLoad).toHaveBeenCalledTimes(1);
  });

  it("blocks deleting the load", async () => {
    const p = locked();
    await expect(createLoadCommands(p).remove(3)).rejects.toThrow(TRIPS);
    expect(p.deleteLoad).not.toHaveBeenCalled();
  });
});

describe("registerBalanceTrip", () => {
  const trip = (over: Partial<BalanceTripInput> = {}): BalanceTripInput => ({
    date: "2026-11-26",
    plate: "ABC-123",
    bags: 5,
    nextDate: null,
    nextPlate: null,
    ...over,
  });

  it("stores a trip with the fleet vehicle", async () => {
    const p = ports();
    await createLoadCommands(p).registerBalanceTrip(1, trip());
    expect(p.insertBalanceTrip).toHaveBeenCalledWith({ balanceId: 1, date: "2026-11-26", plate: "ABC-123", vehicleId: 9, bags: 5 }, null);
  });

  it("asks for the new date when the trip leaves bags behind, and passes the new schedule", async () => {
    const p = ports();
    await expect(createLoadCommands(p).registerBalanceTrip(1, trip({ bags: 2 }))).rejects.toThrow("Elige la nueva fecha del saldo que queda.");
    expect(p.insertBalanceTrip).not.toHaveBeenCalled();
    await createLoadCommands(p).registerBalanceTrip(1, trip({ bags: 2, nextDate: "2026-11-30", nextPlate: "ABC-123" }));
    expect(p.insertBalanceTrip).toHaveBeenCalledWith(expect.objectContaining({ bags: 2 }), { date: "2026-11-30", plate: "ABC-123", vehicleId: 9 });
  });

  it("allows leaving the new plate blank", async () => {
    const p = ports();
    await createLoadCommands(p).registerBalanceTrip(1, trip({ bags: 2, nextDate: "2026-11-30" }));
    expect(p.insertBalanceTrip).toHaveBeenCalledWith(expect.anything(), { date: "2026-11-30", plate: null, vehicleId: null });
  });

  it("ignores a new schedule when the trip carries everything left", async () => {
    const p = ports({ findBalance: vi.fn(async () => ({ id: 1, bags: 5, carried: 2 })) });
    await createLoadCommands(p).registerBalanceTrip(1, trip({ bags: 3, nextDate: "2026-11-30" }));
    expect(p.insertBalanceTrip).toHaveBeenCalledWith(expect.objectContaining({ bags: 3 }), null);
  });

  it("refuses more bags than remain, naming the remaining", async () => {
    const p = ports({ findBalance: vi.fn(async () => ({ id: 1, bags: 5, carried: 2 })) });
    await expect(createLoadCommands(p).registerBalanceTrip(1, trip({ bags: 4 }))).rejects.toThrow(
      "Los bultos del viaje deben ser un número entero entre 1 y 3.",
    );
    expect(p.insertBalanceTrip).not.toHaveBeenCalled();
  });

  it("refuses a balance already carried, a missing one and a plate outside the fleet", async () => {
    const done = ports({ findBalance: vi.fn(async () => ({ id: 1, bags: 5, carried: 5 })) });
    await expect(createLoadCommands(done).registerBalanceTrip(1, trip())).rejects.toThrow("Este saldo ya se llevó completo.");
    const gone = ports({ findBalance: vi.fn(async () => null) });
    await expect(createLoadCommands(gone).registerBalanceTrip(1, trip())).rejects.toThrow("El saldo ya no existe.");
    const p = ports();
    await expect(createLoadCommands(p).registerBalanceTrip(1, trip({ plate: "ZZZ-999" }))).rejects.toThrow("Elige una placa de la flota.");
    await expect(createLoadCommands(p).registerBalanceTrip(1, trip({ bags: 2, nextDate: "2026-11-30", nextPlate: "ZZZ-999" }))).rejects.toThrow(
      "Elige una placa de la flota.",
    );
  });

  it("reports a balance that changed between the check and the write", async () => {
    await expect(
      createLoadCommands(ports({ insertBalanceTrip: vi.fn(async () => "exceeds" as const) })).registerBalanceTrip(1, trip()),
    ).rejects.toThrow("El saldo cambió. Recarga la página e inténtalo de nuevo.");
    await expect(
      createLoadCommands(ports({ insertBalanceTrip: vi.fn(async () => "gone" as const) })).registerBalanceTrip(1, trip()),
    ).rejects.toThrow("El saldo ya no existe.");
  });
});

describe("removeBalanceTrip", () => {
  it("deletes the trip and reports a missing one", async () => {
    const p = ports();
    await createLoadCommands(p).removeBalanceTrip(7);
    expect(p.deleteBalanceTrip).toHaveBeenCalledWith(7);
    await expect(createLoadCommands(ports({ deleteBalanceTrip: vi.fn(async () => false) })).removeBalanceTrip(7)).rejects.toThrow(
      "El viaje ya no existe.",
    );
  });
});
