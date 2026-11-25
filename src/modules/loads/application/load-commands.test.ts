import { describe, expect, it, vi } from "vitest";
import { createLoadCommands, LoadError, type LoadPorts, type OrderForLoad } from "./load-commands";
import type { LoadInput } from "./load-schemas";

// Order 12 asks for 750 Finca bags of product 10: at 40 kg per bag that is exactly 30 t.
const line = { orderId: 12, referenceId: 10, tons: 30, cost: 1_500_000, siesaNumber: "FV-100", orderNumber: "P-77" };

const input = (over: Partial<LoadInput> = {}): LoadInput => ({
  date: "2026-11-18",
  supplier: "Finca",
  plate: "ABC-123",
  notes: null,
  orderIds: [12],
  lines: [line],
  ...over,
});

const storedLine = { orderId: 12, referenceId: 10, tons: 30, cost: 1_500_000, siesaNumber: "FV-100", orderNumber: "P-77" };

const order = (over: Partial<OrderForLoad> = {}): OrderForLoad => ({
  id: 12,
  status: "pendiente",
  loads: [],
  lines: [{ referenceId: 10, label: "C10 · Producto 10", supplier: "Finca", bags: 750 }],
  ...over,
});

function ports(over: Partial<LoadPorts> = {}): LoadPorts {
  return {
    findVehicleByPlate: vi.fn(async (plate: string) => (plate === "ABC-123" ? { id: 9, plate: "ABC-123" } : null)),
    findLoad: vi.fn(async () => ({ plate: "ABC-123", vehicleId: 9 })),
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
    insertLoad: vi.fn(async () => true),
    updateLoad: vi.fn(async () => "ok" as const),
    deleteLoad: vi.fn(async () => true),
    ...over,
  };
}

describe("create", () => {
  it("stores the fleet plate, links the vehicle and checks the catalog products", async () => {
    const p = ports();
    await createLoadCommands(p).create(input());
    expect(p.findCatalogProducts).toHaveBeenCalledWith([10]);
    expect(p.insertLoad).toHaveBeenCalledWith({
      date: "2026-11-18",
      supplier: "Finca",
      plate: "ABC-123",
      vehicleId: 9,
      notes: null,
      orderIds: [12],
      lines: [storedLine],
    });
  });

  it("looks a product up once when two lines carry it", async () => {
    const p = ports();
    const half = { ...line, tons: 15 };
    await createLoadCommands(p).create(input({ lines: [half, { ...half, siesaNumber: "FV-101" }] }));
    expect(p.findCatalogProducts).toHaveBeenCalledWith([10]);
    expect(p.insertLoad).toHaveBeenCalledWith(
      expect.objectContaining({ lines: [{ ...storedLine, tons: 15 }, { ...storedLine, tons: 15, siesaNumber: "FV-101" }] }),
    );
  });

  it("refuses a product that is not in the catalog", async () => {
    const p = ports();
    await expect(createLoadCommands(p).create(input({ lines: [{ ...line, referenceId: 99 }] }))).rejects.toThrow(
      "Un producto del cargue ya no está en el catálogo.",
    );
    expect(p.insertLoad).not.toHaveBeenCalled();
  });

  it("refuses a product of another supplier, naming it", async () => {
    const p = ports();
    await expect(createLoadCommands(p).create(input({ lines: [{ ...line, referenceId: 21 }] }))).rejects.toThrow(
      "El producto C21 · Producto 21 no es del proveedor Finca.",
    );
    expect(p.insertLoad).not.toHaveBeenCalled();
  });

  it("refuses a plate outside the fleet", async () => {
    const p = ports();
    await expect(createLoadCommands(p).create(input({ plate: "ZZZ-999" }))).rejects.toThrow("Elige una placa de la flota.");
    expect(p.insertLoad).not.toHaveBeenCalled();
  });

  it("refuses a load without lines", async () => {
    const p = ports();
    await expect(createLoadCommands(p).create(input({ lines: [] }))).rejects.toThrow("Agrega al menos un producto al cargue.");
  });

  it("names the SIESA number already used by another load", async () => {
    const p = ports({ findTakenSiesa: vi.fn(async () => ["FV-100"]) });
    await expect(createLoadCommands(p).create(input())).rejects.toThrow("Ya existe un cargue con el número SIESA FV-100.");
    expect(p.findTakenSiesa).toHaveBeenCalledWith(["FV-100"], undefined);
    expect(p.findCatalogProducts).not.toHaveBeenCalled();
    expect(p.insertLoad).not.toHaveBeenCalled();
  });

  it("refuses a SIESA number repeated inside the load", async () => {
    const p = ports();
    await expect(createLoadCommands(p).create(input({ lines: [line, { ...line, referenceId: 11 }] }))).rejects.toThrow(
      "El número SIESA FV-100 está repetido en el cargue.",
    );
    expect(p.insertLoad).not.toHaveBeenCalled();
  });

  it("allows repeating the supplier order number across lines", async () => {
    const p = ports();
    const half = { ...line, tons: 15 };
    await createLoadCommands(p).create(input({ lines: [half, { ...half, siesaNumber: "FV-101" }] }));
    expect(p.insertLoad).toHaveBeenCalledTimes(1);
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
    await expect(createLoadCommands(p).update(3, input({ lines: [{ ...line, referenceId: 5 }] }))).rejects.toThrow(
      "Un producto del cargue ya no está en el catálogo.",
    );
    expect(p.updateLoad).not.toHaveBeenCalled();
  });

  it("refuses a SIESA number held by another load", async () => {
    const p = ports({ findTakenSiesa: vi.fn(async () => ["FV-100"]) });
    await expect(createLoadCommands(p).update(3, input())).rejects.toThrow(LoadError);
  });

  it("keeps the stored plate when its vehicle left the fleet and the plate is unchanged", async () => {
    const p = ports({ findLoad: vi.fn(async () => ({ plate: "OLD-111", vehicleId: null })) });
    await createLoadCommands(p).update(3, input({ plate: "OLD-111" }));
    expect(p.updateLoad).toHaveBeenCalledWith(3, expect.objectContaining({ plate: "OLD-111", vehicleId: null }));
  });

  it("refuses a different plate outside the fleet", async () => {
    const p = ports({ findLoad: vi.fn(async () => ({ plate: "OLD-111", vehicleId: null })) });
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
});

describe("orders of the load", () => {
  it("looks the checked orders up and takes the current kg per bag", async () => {
    const p = ports();
    await createLoadCommands(p).create(input());
    expect(p.findOrdersForLoad).toHaveBeenCalledWith([12]);
    expect(p.getKgPerBag).toHaveBeenCalled();
  });

  it("refuses a load with no order", async () => {
    const p = ports();
    await expect(createLoadCommands(p).create(input({ orderIds: [] }))).rejects.toThrow("Elige al menos un pedido.");
    expect(p.insertLoad).not.toHaveBeenCalled();
  });

  it("refuses an annulled or missing order", async () => {
    const annulled = ports({ findOrdersForLoad: vi.fn(async () => [order({ status: "anulado" })]) });
    await expect(createLoadCommands(annulled).create(input())).rejects.toThrow(
      "Algún pedido ya no está disponible: está anulado o ya tiene cargue de este proveedor.",
    );
    const missing = ports({ findOrdersForLoad: vi.fn(async () => []) });
    await expect(createLoadCommands(missing).create(input())).rejects.toThrow(LoadError);
    expect(annulled.insertLoad).not.toHaveBeenCalled();
  });

  it("refuses an order whose part of this supplier is already in another load", async () => {
    const p = ports({ findOrdersForLoad: vi.fn(async () => [order({ loads: [{ loadId: 8, supplier: "Finca" }] })]) });
    await expect(createLoadCommands(p).update(4, input())).rejects.toThrow(LoadError);
    expect(p.updateLoad).not.toHaveBeenCalled();
  });

  it("takes the part of an order another supplier already loaded", async () => {
    const p = ports({ findOrdersForLoad: vi.fn(async () => [order({ loads: [{ loadId: 8, supplier: "Italcol" }] })]) });
    await createLoadCommands(p).create(input());
    expect(p.insertLoad).toHaveBeenCalledTimes(1);
  });

  it("keeps the part of an order that already belongs to the load being edited", async () => {
    const p = ports({ findOrdersForLoad: vi.fn(async () => [order({ status: "cargado", loads: [{ loadId: 4, supplier: "Finca" }] })]) });
    await createLoadCommands(p).update(4, input());
    expect(p.updateLoad).toHaveBeenCalledWith(4, expect.objectContaining({ orderIds: [12] }));
  });

  it("reports an order that was taken between the check and the write", async () => {
    const created = ports({ insertLoad: vi.fn(async () => false) });
    await expect(createLoadCommands(created).create(input())).rejects.toThrow("Algún pedido ya no está disponible");
    const updated = ports({ updateLoad: vi.fn(async () => "orders_unavailable" as const) });
    await expect(createLoadCommands(updated).update(4, input())).rejects.toThrow("Algún pedido ya no está disponible");
  });
});

describe("tons against the order", () => {
  it("blocks a load short of the ordered weight, naming the order, the product and the kilos", async () => {
    const p = ports();
    await expect(createLoadCommands(p).create(input({ lines: [{ ...line, tons: 29.95 }] }))).rejects.toThrow(
      "Pedido #12 · C10 · Producto 10: faltan 50 kg",
    );
    expect(p.insertLoad).not.toHaveBeenCalled();
  });

  it("blocks a load over the ordered weight", async () => {
    const p = ports();
    await expect(createLoadCommands(p).update(4, input({ lines: [{ ...line, tons: 30.001 }] }))).rejects.toThrow("sobra 1 kg");
    expect(p.updateLoad).not.toHaveBeenCalled();
  });

  it("uses the kg per bag in force now", async () => {
    const p = ports({ getKgPerBag: vi.fn(async () => 45) });
    await expect(createLoadCommands(p).create(input())).rejects.toThrow("faltan 3.750 kg");
  });

  it("blocks a checked order with no lines", async () => {
    const p = ports();
    await expect(createLoadCommands(p).create(input({ orderIds: [12, 13], lines: [line] }))).rejects.toThrow();
    const two = ports({ findOrdersForLoad: vi.fn(async () => [order(), order({ id: 13 })]) });
    await expect(createLoadCommands(two).create(input({ orderIds: [12, 13] }))).rejects.toThrow("Pedido #13: agrega los productos de Finca que se cargan.");
  });

  it("reports every violation at once", async () => {
    const p = ports({ findOrdersForLoad: vi.fn(async () => [order(), order({ id: 13 })]) });
    await expect(createLoadCommands(p).create(input({ orderIds: [12, 13], lines: [{ ...line, tons: 29 }] }))).rejects.toThrow(
      "Pedido #12 · C10 · Producto 10: faltan 1.000 kg; Pedido #13: agrega los productos de Finca que se cargan.",
    );
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
