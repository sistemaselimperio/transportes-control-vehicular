import { describe, expect, it, vi } from "vitest";
import { createLoadCommands, LoadError, type LoadPorts } from "./load-commands";
import type { LoadInput } from "./load-schemas";

const line = { reference: "Engorde 40", tons: 30, cost: 1_500_000, siesaNumber: "FV-100", orderNumber: "P-77" };

const input = (over: Partial<LoadInput> = {}): LoadInput => ({
  date: "2026-11-18",
  supplier: "Finca",
  plate: "ABC-123",
  notes: null,
  orderIds: [],
  lines: [line],
  ...over,
});

const storedLine = { referenceId: 10, tons: 30, cost: 1_500_000, siesaNumber: "FV-100", orderNumber: "P-77" };

function ports(over: Partial<LoadPorts> = {}): LoadPorts {
  return {
    findVehicleByPlate: vi.fn(async (plate: string) => (plate === "ABC-123" ? { id: 9, plate: "ABC-123" } : null)),
    findLoad: vi.fn(async () => ({ plate: "ABC-123", vehicleId: 9 })),
    findTakenSiesa: vi.fn(async () => []),
    ensureReferences: vi.fn(async (refs: ReadonlyArray<{ name: string; key: string }>) => new Map(refs.map((r, i) => [r.key, 10 + i]))),
    findOrdersByIds: vi.fn(async () => []),
    insertLoad: vi.fn(async () => true),
    updateLoad: vi.fn(async () => "ok" as const),
    deleteLoad: vi.fn(async () => true),
    ...over,
  };
}

describe("create", () => {
  it("stores the fleet plate, links the vehicle and swaps each product for its reference id", async () => {
    const p = ports();
    await createLoadCommands(p).create(input());
    expect(p.ensureReferences).toHaveBeenCalledWith([{ name: "Engorde 40", key: "engorde40" }]);
    expect(p.insertLoad).toHaveBeenCalledWith({
      date: "2026-11-18",
      supplier: "Finca",
      plate: "ABC-123",
      vehicleId: 9,
      notes: null,
      orderIds: [],
      lines: [storedLine],
    });
  });

  it("reuses one reference for a product typed twice", async () => {
    const p = ports();
    await createLoadCommands(p).create(input({ lines: [line, { ...line, reference: "engorde  40", siesaNumber: "FV-101" }] }));
    expect(p.ensureReferences).toHaveBeenCalledWith([{ name: "Engorde 40", key: "engorde40" }]);
    expect(p.insertLoad).toHaveBeenCalledWith(
      expect.objectContaining({ lines: [storedLine, { ...storedLine, siesaNumber: "FV-101" }] }),
    );
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
    expect(p.ensureReferences).not.toHaveBeenCalled();
    expect(p.insertLoad).not.toHaveBeenCalled();
  });

  it("refuses a SIESA number repeated inside the load", async () => {
    const p = ports();
    await expect(createLoadCommands(p).create(input({ lines: [line, { ...line, reference: "Levante" }] }))).rejects.toThrow(
      "El número SIESA FV-100 está repetido en el cargue.",
    );
    expect(p.insertLoad).not.toHaveBeenCalled();
  });

  it("allows repeating the supplier order number across lines", async () => {
    const p = ports();
    await createLoadCommands(p).create(input({ lines: [line, { ...line, reference: "Levante", siesaNumber: "FV-101" }] }));
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

describe("linked orders", () => {
  const pending = (id: number) => ({ id, status: "pendiente" as const, loadId: null });

  it("stores the checked orders with the load", async () => {
    const p = ports({ findOrdersByIds: vi.fn(async () => [pending(3), pending(5)]) });
    await createLoadCommands(p).create(input({ orderIds: [3, 5] }));
    expect(p.findOrdersByIds).toHaveBeenCalledWith([3, 5]);
    expect(p.insertLoad).toHaveBeenCalledWith(expect.objectContaining({ orderIds: [3, 5] }));
  });

  it("does not look orders up when none is checked", async () => {
    const p = ports();
    await createLoadCommands(p).create(input());
    expect(p.findOrdersByIds).not.toHaveBeenCalled();
  });

  it("refuses an annulled order", async () => {
    const p = ports({ findOrdersByIds: vi.fn(async () => [{ id: 3, status: "anulado" as const, loadId: null }]) });
    await expect(createLoadCommands(p).create(input({ orderIds: [3] }))).rejects.toThrow(
      "Algún pedido ya no está disponible: está anulado o ya pertenece a otro cargue.",
    );
    expect(p.insertLoad).not.toHaveBeenCalled();
  });

  it("refuses an order already linked to another load", async () => {
    const p = ports({ findOrdersByIds: vi.fn(async () => [{ id: 3, status: "cargado" as const, loadId: 8 }]) });
    await expect(createLoadCommands(p).update(4, input({ orderIds: [3] }))).rejects.toThrow(LoadError);
    expect(p.updateLoad).not.toHaveBeenCalled();
  });

  it("keeps an order that is already linked to the load being edited", async () => {
    const p = ports({ findOrdersByIds: vi.fn(async () => [{ id: 3, status: "cargado" as const, loadId: 4 }]) });
    await createLoadCommands(p).update(4, input({ orderIds: [3] }));
    expect(p.updateLoad).toHaveBeenCalledWith(4, expect.objectContaining({ orderIds: [3] }));
  });

  it("reports an order that was taken between the check and the write", async () => {
    const created = ports({ findOrdersByIds: vi.fn(async () => [pending(3)]), insertLoad: vi.fn(async () => false) });
    await expect(createLoadCommands(created).create(input({ orderIds: [3] }))).rejects.toThrow("Algún pedido ya no está disponible");
    const updated = ports({
      findOrdersByIds: vi.fn(async () => [pending(3)]),
      updateLoad: vi.fn(async () => "orders_unavailable" as const),
    });
    await expect(createLoadCommands(updated).update(4, input({ orderIds: [3] }))).rejects.toThrow("Algún pedido ya no está disponible");
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
