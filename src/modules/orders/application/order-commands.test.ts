import { describe, expect, it, vi } from "vitest";
import { createOrderCommands, OrderError, type OrderPorts } from "./order-commands";
import type { OrderInput } from "./order-schemas";

const input = (over: Partial<OrderInput> = {}): OrderInput => ({
  deliveryDate: "2026-11-20",
  timeWindow: "7–11 a.m.",
  note: null,
  lines: [{ clientId: 3, locationId: 7, referenceId: 10, bags: 50 }],
  ...over,
});

function ports(over: Partial<OrderPorts> = {}): OrderPorts {
  return {
    findExistingClientIds: vi.fn(async (ids: number[]) => ids.filter((id) => id !== 99)),
    findLocationOwners: vi.fn(async (ids: number[]) => ids.map((id) => ({ id, clientId: id === 7 ? 3 : 4 }))),
    findCatalogProducts: vi.fn(async (ids: number[]) => ids.filter((id) => id !== 98).map((id) => ({ id, code: `C${id}`, name: `Producto ${id}`, supplier: "Finca" as const }))),
    findOrder: vi.fn(async () => ({ status: "pendiente" as const, hasLoads: false })),
    insertOrder: vi.fn(async () => 1),
    replaceOrder: vi.fn(async () => true),
    annulOrder: vi.fn(async () => true),
    saveKgPerBag: vi.fn(async () => undefined),
    findOrdersForDelivery: vi.fn(async (ids: number[]) => ids.map((id) => ({ id, status: "cargado" as const }))),
    findBalances: vi.fn(async () => []),
    findLoadOrderIds: vi.fn(async () => [13, 14]),
    markDelivered: vi.fn(async () => true),
    clearDelivery: vi.fn(async (ids: number[]) => ids.length),
    ...over,
  };
}

describe("create", () => {
  it("checks the catalog products once and stores the lines in order", async () => {
    const p = ports();
    await createOrderCommands(p).create(
      input({
        lines: [
          { clientId: 3, locationId: 7, referenceId: 10, bags: 50 },
          { clientId: 3, locationId: 7, referenceId: 11, bags: 10 },
        ],
      }),
    );
    expect(p.findCatalogProducts).toHaveBeenCalledWith([10, 11]);
    expect(p.insertOrder).toHaveBeenCalledWith({
      deliveryDate: "2026-11-20",
      timeWindow: "7–11 a.m.",
      note: null,
      lines: [
        { clientId: 3, locationId: 7, referenceId: 10, bags: 50 },
        { clientId: 3, locationId: 7, referenceId: 11, bags: 10 },
      ],
    });
  });

  it("refuses lines of more than one client", async () => {
    const p = ports();
    await expect(
      createOrderCommands(p).create(
        input({
          lines: [
            { clientId: 3, locationId: null, referenceId: 10, bags: 1 },
            { clientId: 4, locationId: null, referenceId: 11, bags: 1 },
          ],
        }),
      ),
    ).rejects.toThrow("Un pedido solo puede tener un cliente.");
    expect(p.insertOrder).not.toHaveBeenCalled();
  });

  it("refuses lines of more than one finca", async () => {
    const p = ports();
    await expect(
      createOrderCommands(p).create(
        input({
          lines: [
            { clientId: 3, locationId: 7, referenceId: 10, bags: 1 },
            { clientId: 3, locationId: null, referenceId: 11, bags: 1 },
          ],
        }),
      ),
    ).rejects.toThrow("Un pedido solo puede tener una finca.");
    expect(p.insertOrder).not.toHaveBeenCalled();
  });

  it("refuses the same product twice", async () => {
    const p = ports();
    await expect(
      createOrderCommands(p).update(
        5,
        input({
          lines: [
            { clientId: 3, locationId: 7, referenceId: 10, bags: 1 },
            { clientId: 3, locationId: 7, referenceId: 10, bags: 2 },
          ],
        }),
      ),
    ).rejects.toThrow("Un producto no puede repetirse en el pedido.");
    expect(p.replaceOrder).not.toHaveBeenCalled();
  });

  it("refuses a product that is not in the catalog", async () => {
    const p = ports();
    await expect(
      createOrderCommands(p).create(input({ lines: [{ clientId: 3, locationId: null, referenceId: 98, bags: 1 }] })),
    ).rejects.toThrow("Un producto del pedido ya no está en el catálogo.");
    expect(p.insertOrder).not.toHaveBeenCalled();
  });

  it("refuses a client that no longer exists", async () => {
    const p = ports();
    await expect(
      createOrderCommands(p).create(input({ lines: [{ clientId: 99, locationId: null, referenceId: 10, bags: 1 }] })),
    ).rejects.toThrow("Un cliente del pedido ya no existe.");
    expect(p.insertOrder).not.toHaveBeenCalled();
  });

  it("refuses a finca that belongs to another client", async () => {
    const p = ports();
    await expect(
      createOrderCommands(p).create(input({ lines: [{ clientId: 3, locationId: 8, referenceId: 10, bags: 1 }] })),
    ).rejects.toThrow("La finca elegida no pertenece al cliente.");
    expect(p.insertOrder).not.toHaveBeenCalled();
    expect(p.findCatalogProducts).not.toHaveBeenCalled();
  });

  it("refuses a finca that no longer exists", async () => {
    const p = ports({ findLocationOwners: vi.fn(async () => []) });
    await expect(createOrderCommands(p).create(input())).rejects.toThrow("La finca elegida no pertenece al cliente.");
  });
});

describe("update", () => {
  it("refuses a product that left the catalog", async () => {
    const p = ports();
    await expect(
      createOrderCommands(p).update(5, input({ lines: [{ clientId: 3, locationId: null, referenceId: 98, bags: 1 }] })),
    ).rejects.toThrow("Un producto del pedido ya no está en el catálogo.");
    expect(p.replaceOrder).not.toHaveBeenCalled();
  });

  it("replaces a pending order", async () => {
    const p = ports();
    await createOrderCommands(p).update(5, input());
    expect(p.replaceOrder).toHaveBeenCalledWith(5, expect.objectContaining({ deliveryDate: "2026-11-20" }));
  });

  it.each(["cargado", "anulado"] as const)("refuses a %s order", async (status) => {
    const p = ports({ findOrder: vi.fn(async () => ({ status, hasLoads: status === "cargado" })) });
    await expect(createOrderCommands(p).update(5, input())).rejects.toThrow("Solo se pueden modificar los pedidos pendientes sin cargues.");
    expect(p.replaceOrder).not.toHaveBeenCalled();
  });

  it("refuses a partially loaded order: a load already took part of it", async () => {
    const p = ports({ findOrder: vi.fn(async () => ({ status: "pendiente" as const, hasLoads: true })) });
    await expect(createOrderCommands(p).update(5, input())).rejects.toThrow("Solo se pueden modificar los pedidos pendientes sin cargues.");
    await expect(createOrderCommands(p).annul(5)).rejects.toThrow("Solo se pueden anular los pedidos pendientes sin cargues.");
    expect(p.replaceOrder).not.toHaveBeenCalled();
    expect(p.annulOrder).not.toHaveBeenCalled();
  });

  it("fails when the order vanished", async () => {
    const p = ports({ findOrder: vi.fn(async () => null) });
    await expect(createOrderCommands(p).update(5, input())).rejects.toThrow("El pedido ya no existe.");
  });

  it("fails when the order got loaded between the check and the write", async () => {
    const p = ports({ replaceOrder: vi.fn(async () => false) });
    await expect(createOrderCommands(p).update(5, input())).rejects.toThrow("Solo se pueden modificar los pedidos pendientes sin cargues.");
  });
});

describe("annul", () => {
  it("annuls a pending order", async () => {
    const p = ports();
    await createOrderCommands(p).annul(5);
    expect(p.annulOrder).toHaveBeenCalledWith(5);
  });

  it("refuses a loaded order", async () => {
    const p = ports({ findOrder: vi.fn(async () => ({ status: "cargado" as const, hasLoads: true })) });
    await expect(createOrderCommands(p).annul(5)).rejects.toThrow("Solo se pueden anular los pedidos pendientes sin cargues.");
    expect(p.annulOrder).not.toHaveBeenCalled();
  });

  it("fails when the order got loaded between the check and the write", async () => {
    const p = ports({ annulOrder: vi.fn(async () => false) });
    await expect(createOrderCommands(p).annul(5)).rejects.toThrow("Solo se pueden anular los pedidos pendientes sin cargues.");
  });

  it("fails when the order vanished", async () => {
    const p = ports({ findOrder: vi.fn(async () => null) });
    await expect(createOrderCommands(p).annul(5)).rejects.toThrow("El pedido ya no existe.");
  });
});

describe("setKgPerBag", () => {
  it("saves a valid value", async () => {
    const p = ports();
    await createOrderCommands(p).setKgPerBag(42.5);
    expect(p.saveKgPerBag).toHaveBeenCalledWith(42.5);
  });

  it("refuses a non positive value", async () => {
    const p = ports();
    await expect(createOrderCommands(p).setKgPerBag(0)).rejects.toBeInstanceOf(OrderError);
    expect(p.saveKgPerBag).not.toHaveBeenCalled();
  });
});

describe("deliver", () => {
  const today = () => "2026-11-26";
  const commands = (p: OrderPorts) => createOrderCommands(p, today);

  it("marks the loaded orders as delivered on the day, by the user", async () => {
    const p = ports();
    await expect(commands(p).deliver([13, 14], "2026-11-25", "u1")).resolves.toBe(2);
    expect(p.markDelivered).toHaveBeenCalledWith([13, 14], "2026-11-25", "u1");
  });

  it("refuses an order that is gone", async () => {
    const p = ports({ findOrdersForDelivery: vi.fn(async () => [{ id: 13, status: "cargado" as const }]) });
    await expect(commands(p).deliver([13, 14], "2026-11-25", "u1")).rejects.toThrow("El pedido ya no existe.");
    expect(p.markDelivered).not.toHaveBeenCalled();
  });

  it("refuses all of them when one is not loaded completely", async () => {
    const p = ports({
      findOrdersForDelivery: vi.fn(async () => [
        { id: 13, status: "cargado" as const },
        { id: 14, status: "pendiente" as const },
      ]),
    });
    await expect(commands(p).deliver([13, 14], "2026-11-25", "u1")).rejects.toThrow("El pedido #14 aún no está cargado completo.");
    expect(p.markDelivered).not.toHaveBeenCalled();
  });

  it("refuses an order with a balance still to carry", async () => {
    const p = ports({ findBalances: vi.fn(async () => [{ orderId: 13, bags: 175, trips: [] }]) });
    await expect(commands(p).deliver([13], "2026-11-25", "u1")).rejects.toThrow("El pedido #13 tiene 175 bultos de saldo por llevar.");
    expect(p.markDelivered).not.toHaveBeenCalled();
  });

  it("skips the orders already delivered and delivers the rest", async () => {
    const p = ports({
      findOrdersForDelivery: vi.fn(async () => [
        { id: 13, status: "entregado" as const },
        { id: 14, status: "cargado" as const },
      ]),
    });
    await expect(commands(p).deliver([13, 14], "2026-11-25", "u1")).resolves.toBe(1);
    expect(p.markDelivered).toHaveBeenCalledWith([14], "2026-11-25", "u1");
  });

  it("refuses when everything is already delivered", async () => {
    const p = ports({ findOrdersForDelivery: vi.fn(async () => [{ id: 13, status: "entregado" as const }]) });
    await expect(commands(p).deliver([13], "2026-11-25", "u1")).rejects.toThrow("El pedido #13 ya está entregado.");
  });

  it("refuses a delivery day in the future", async () => {
    const p = ports();
    await expect(commands(p).deliver([13], "2026-11-27", "u1")).rejects.toThrow("La fecha de entrega no puede ser futura.");
    expect(p.markDelivered).not.toHaveBeenCalled();
  });

  it("refuses without orders", async () => {
    await expect(commands(ports()).deliver([], "2026-11-25", "u1")).rejects.toThrow("Elige al menos un pedido.");
  });

  it("refuses when the order changed meanwhile and nothing was stored", async () => {
    const p = ports({ markDelivered: vi.fn(async () => false) });
    await expect(commands(p).deliver([13], "2026-11-25", "u1")).rejects.toThrow("Los pedidos cambiaron mientras tanto. Revisa e inténtalo de nuevo.");
  });
});

describe("deliverLoad", () => {
  it("delivers every order of the load", async () => {
    const p = ports();
    await createOrderCommands(p, () => "2026-11-26").deliverLoad(5, "2026-11-26", "u1");
    expect(p.findLoadOrderIds).toHaveBeenCalledWith(5);
    expect(p.markDelivered).toHaveBeenCalledWith([13, 14], "2026-11-26", "u1");
  });

  it("refuses a load without orders", async () => {
    const p = ports({ findLoadOrderIds: vi.fn(async () => []) });
    await expect(createOrderCommands(p, () => "2026-11-26").deliverLoad(5, "2026-11-26", "u1")).rejects.toThrow(
      "El cargue no tiene pedidos para entregar.",
    );
  });

  it("is all or nothing: one order that cannot be delivered refuses the whole load", async () => {
    const p = ports({ findBalances: vi.fn(async () => [{ orderId: 14, bags: 5, trips: [] }]) });
    await expect(createOrderCommands(p, () => "2026-11-26").deliverLoad(5, "2026-11-26", "u1")).rejects.toThrow(
      "El pedido #14 tiene 5 bultos de saldo por llevar.",
    );
    expect(p.markDelivered).not.toHaveBeenCalled();
  });
});

describe("undo delivery", () => {
  it("clears the delivery of the orders", async () => {
    const p = ports();
    await createOrderCommands(p).undoDelivery([13, 14]);
    expect(p.clearDelivery).toHaveBeenCalledWith([13, 14]);
  });

  it("refuses when none of them was delivered", async () => {
    const p = ports({ clearDelivery: vi.fn(async () => 0) });
    await expect(createOrderCommands(p).undoDelivery([13])).rejects.toThrow("Los pedidos no están entregados.");
  });

  it("clears every order of a load", async () => {
    const p = ports();
    await createOrderCommands(p).undoLoadDelivery(5);
    expect(p.findLoadOrderIds).toHaveBeenCalledWith(5);
    expect(p.clearDelivery).toHaveBeenCalledWith([13, 14]);
  });

  it("refuses a load without orders", async () => {
    const p = ports({ findLoadOrderIds: vi.fn(async () => []) });
    await expect(createOrderCommands(p).undoLoadDelivery(5)).rejects.toThrow("El cargue no tiene pedidos para entregar.");
  });
});
