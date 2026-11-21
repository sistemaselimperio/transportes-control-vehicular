import { describe, expect, it, vi } from "vitest";
import { createOrderCommands, OrderError, type OrderPorts } from "./order-commands";
import type { OrderInput } from "./order-schemas";

const input = (over: Partial<OrderInput> = {}): OrderInput => ({
  deliveryDate: "2026-11-20",
  timeWindow: "7–11 a.m.",
  note: null,
  lines: [{ clientId: 3, locationId: 7, reference: "Engorde 40", bags: 50 }],
  ...over,
});

function ports(over: Partial<OrderPorts> = {}): OrderPorts {
  return {
    findExistingClientIds: vi.fn(async (ids: number[]) => ids.filter((id) => id !== 99)),
    findLocationOwners: vi.fn(async (ids: number[]) => ids.map((id) => ({ id, clientId: id === 7 ? 3 : 4 }))),
    ensureReferences: vi.fn(
      async (refs: ReadonlyArray<{ name: string; key: string }>) => new Map(refs.map((r, i) => [r.key, 10 + i])),
    ),
    findOrder: vi.fn(async () => ({ status: "pendiente" as const, loadId: null })),
    insertOrder: vi.fn(async () => 1),
    replaceOrder: vi.fn(async () => true),
    annulOrder: vi.fn(async () => true),
    saveKgPerBag: vi.fn(async () => undefined),
    ...over,
  };
}

describe("create", () => {
  it("resolves the references and stores the lines in order", async () => {
    const p = ports();
    await createOrderCommands(p).create(
      input({
        lines: [
          { clientId: 3, locationId: 7, reference: "Engorde 40", bags: 50 },
          { clientId: 3, locationId: null, reference: "Levante", bags: 10 },
        ],
      }),
    );
    expect(p.ensureReferences).toHaveBeenCalledWith([
      { name: "Engorde 40", key: "engorde40" },
      { name: "Levante", key: "levante" },
    ]);
    expect(p.insertOrder).toHaveBeenCalledWith({
      deliveryDate: "2026-11-20",
      timeWindow: "7–11 a.m.",
      note: null,
      lines: [
        { clientId: 3, locationId: 7, referenceId: 10, bags: 50 },
        { clientId: 3, locationId: null, referenceId: 11, bags: 10 },
      ],
    });
  });

  it("dedupes a reference typed twice with different casing or accents", async () => {
    const p = ports();
    await createOrderCommands(p).create(
      input({
        lines: [
          { clientId: 3, locationId: null, reference: "Engorde Último", bags: 5 },
          { clientId: 4, locationId: null, reference: "engorde ultimo", bags: 5 },
        ],
      }),
    );
    expect(p.ensureReferences).toHaveBeenCalledWith([{ name: "Engorde Último", key: "engordeultimo" }]);
    const stored = vi.mocked(p.insertOrder).mock.calls[0]?.[0];
    expect(stored?.lines.map((l) => l.referenceId)).toEqual([10, 10]);
  });

  it("refuses a client that no longer exists", async () => {
    const p = ports();
    await expect(
      createOrderCommands(p).create(input({ lines: [{ clientId: 99, locationId: null, reference: "X", bags: 1 }] })),
    ).rejects.toThrow("Un cliente del pedido ya no existe.");
    expect(p.insertOrder).not.toHaveBeenCalled();
  });

  it("refuses a finca that belongs to another client", async () => {
    const p = ports();
    await expect(
      createOrderCommands(p).create(input({ lines: [{ clientId: 3, locationId: 8, reference: "X", bags: 1 }] })),
    ).rejects.toThrow("La finca elegida no pertenece al cliente.");
    expect(p.insertOrder).not.toHaveBeenCalled();
    expect(p.ensureReferences).not.toHaveBeenCalled();
  });

  it("refuses a finca that no longer exists", async () => {
    const p = ports({ findLocationOwners: vi.fn(async () => []) });
    await expect(createOrderCommands(p).create(input())).rejects.toThrow("La finca elegida no pertenece al cliente.");
  });
});

describe("update", () => {
  it("replaces a pending order", async () => {
    const p = ports();
    await createOrderCommands(p).update(5, input());
    expect(p.replaceOrder).toHaveBeenCalledWith(5, expect.objectContaining({ deliveryDate: "2026-11-20" }));
  });

  it.each(["cargado", "anulado"] as const)("refuses a %s order", async (status) => {
    const p = ports({ findOrder: vi.fn(async () => ({ status, loadId: status === "cargado" ? 2 : null })) });
    await expect(createOrderCommands(p).update(5, input())).rejects.toThrow("Solo se pueden modificar los pedidos pendientes.");
    expect(p.replaceOrder).not.toHaveBeenCalled();
  });

  it("fails when the order vanished", async () => {
    const p = ports({ findOrder: vi.fn(async () => null) });
    await expect(createOrderCommands(p).update(5, input())).rejects.toThrow("El pedido ya no existe.");
  });

  it("fails when the order got loaded between the check and the write", async () => {
    const p = ports({ replaceOrder: vi.fn(async () => false) });
    await expect(createOrderCommands(p).update(5, input())).rejects.toThrow("Solo se pueden modificar los pedidos pendientes.");
  });
});

describe("annul", () => {
  it("annuls a pending order", async () => {
    const p = ports();
    await createOrderCommands(p).annul(5);
    expect(p.annulOrder).toHaveBeenCalledWith(5);
  });

  it("refuses a loaded order", async () => {
    const p = ports({ findOrder: vi.fn(async () => ({ status: "cargado" as const, loadId: 2 })) });
    await expect(createOrderCommands(p).annul(5)).rejects.toThrow("Solo se pueden anular los pedidos pendientes.");
    expect(p.annulOrder).not.toHaveBeenCalled();
  });

  it("fails when the order got loaded between the check and the write", async () => {
    const p = ports({ annulOrder: vi.fn(async () => false) });
    await expect(createOrderCommands(p).annul(5)).rejects.toThrow("Solo se pueden anular los pedidos pendientes.");
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
