import { describe, expect, it, vi } from "vitest";
import { createLoadCommands, LoadError, type LoadPorts } from "./load-commands";
import type { LoadInput } from "./load-schemas";

const input = (over: Partial<LoadInput> = {}): LoadInput => ({
  date: "2026-11-18",
  supplier: "Finca",
  plate: "ABC-123",
  tons: 30,
  cost: 1_500_000,
  siesaNumber: "FV-100",
  orderNumber: "P-77",
  notes: null,
  ...over,
});

function ports(over: Partial<LoadPorts> = {}): LoadPorts {
  return {
    findVehicleByPlate: vi.fn(async (plate: string) => (plate === "ABC-123" ? { id: 9, plate: "ABC-123" } : null)),
    findLoad: vi.fn(async () => ({ plate: "ABC-123", vehicleId: 9 })),
    findLoadIdBySiesa: vi.fn(async () => null),
    insertLoad: vi.fn(async () => undefined),
    updateLoad: vi.fn(async () => true),
    deleteLoad: vi.fn(async () => true),
    ...over,
  };
}

describe("create", () => {
  it("stores the fleet plate and links the vehicle", async () => {
    const p = ports();
    await createLoadCommands(p).create(input());
    expect(p.insertLoad).toHaveBeenCalledWith({ ...input(), plate: "ABC-123", vehicleId: 9 });
  });

  it("refuses a plate outside the fleet", async () => {
    const p = ports();
    await expect(createLoadCommands(p).create(input({ plate: "ZZZ-999" }))).rejects.toThrow("Elige una placa de la flota.");
    expect(p.insertLoad).not.toHaveBeenCalled();
  });

  it("refuses a SIESA number already used by another load", async () => {
    const p = ports({ findLoadIdBySiesa: vi.fn(async () => 5) });
    await expect(createLoadCommands(p).create(input())).rejects.toThrow("Ya existe un cargue con ese número SIESA.");
    expect(p.insertLoad).not.toHaveBeenCalled();
  });

  it("allows repeating the order number", async () => {
    const p = ports();
    await createLoadCommands(p).create(input({ orderNumber: "P-1" }));
    await createLoadCommands(p).create(input({ siesaNumber: "FV-101", orderNumber: "P-1" }));
    expect(p.insertLoad).toHaveBeenCalledTimes(2);
  });
});

describe("update", () => {
  it("ignores its own SIESA number", async () => {
    const p = ports();
    await createLoadCommands(p).update(3, input());
    expect(p.findLoadIdBySiesa).toHaveBeenCalledWith("FV-100", 3);
    expect(p.updateLoad).toHaveBeenCalledWith(3, { ...input(), plate: "ABC-123", vehicleId: 9 });
  });

  it("refuses a SIESA number held by another load", async () => {
    const p = ports({ findLoadIdBySiesa: vi.fn(async () => 8) });
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
    await expect(createLoadCommands(ports({ updateLoad: vi.fn(async () => false) })).update(3, input())).rejects.toThrow(
      "El cargue ya no existe.",
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
