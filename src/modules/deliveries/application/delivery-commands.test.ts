import { describe, expect, it, vi } from "vitest";
import { createDeliveryCommands, DeliveryError, type DeliveryPorts } from "./delivery-commands";
import type { DeliveryInput } from "./delivery-schemas";

const input = (over: Partial<DeliveryInput> = {}): DeliveryInput => ({
  date: "2026-11-18",
  shift: "1er viaje",
  priority: "normal",
  clientId: 4,
  locationId: null,
  destination: "Simijaca (Cundinamarca)",
  quantity: 40,
  weightKg: 2000,
  plate: "ABC-123",
  notes: null,
  ...over,
});

function ports(over: Partial<DeliveryPorts> = {}): DeliveryPorts {
  return {
    clientExists: vi.fn(async () => true),
    locationBelongsToClient: vi.fn(async () => true),
    findVehicleByPlate: vi.fn(async (plate: string) => (plate === "ABC-123" ? { id: 9, plate: "ABC-123" } : null)),
    findDelivery: vi.fn(async () => ({ plate: null, vehicleId: null })),
    insertDelivery: vi.fn(async () => undefined),
    updateDelivery: vi.fn(async () => true),
    setStatus: vi.fn(async () => true),
    deleteDelivery: vi.fn(async () => true),
    ...over,
  };
}

describe("create", () => {
  it("inserts a delivery linked to its fleet vehicle", async () => {
    const p = ports();
    await createDeliveryCommands(p).create(input());
    expect(p.insertDelivery).toHaveBeenCalledWith({ ...input(), plate: "ABC-123", vehicleId: 9 });
  });

  it("links the fleet vehicle when a plate is given", async () => {
    const p = ports();
    await createDeliveryCommands(p).create(input({ plate: "ABC-123" }));
    expect(p.insertDelivery).toHaveBeenCalledWith(expect.objectContaining({ plate: "ABC-123", vehicleId: 9 }));
  });

  it("refuses a plate outside the fleet", async () => {
    const p = ports();
    await expect(createDeliveryCommands(p).create(input({ plate: "ZZZ-999" }))).rejects.toThrow("Elige una placa de la flota.");
    expect(p.insertDelivery).not.toHaveBeenCalled();
  });

  it("refuses a client that does not exist", async () => {
    const noClient = ports({ clientExists: vi.fn(async () => false) });
    await expect(createDeliveryCommands(noClient).create(input())).rejects.toThrow("El cliente ya no existe.");
    expect(noClient.insertDelivery).not.toHaveBeenCalled();
  });
});

describe("finca", () => {
  it("does not check the finca when the delivery has none", async () => {
    const p = ports();
    await createDeliveryCommands(p).create(input());
    expect(p.locationBelongsToClient).not.toHaveBeenCalled();
  });

  it("saves a finca that belongs to the delivery's client", async () => {
    const p = ports();
    await createDeliveryCommands(p).create(input({ locationId: 12 }));
    expect(p.locationBelongsToClient).toHaveBeenCalledWith(12, 4);
    expect(p.insertDelivery).toHaveBeenCalledWith(expect.objectContaining({ locationId: 12 }));
  });

  it("refuses a finca of another client, or one that is gone, on create and update", async () => {
    const p = ports({ locationBelongsToClient: vi.fn(async () => false) });
    await expect(createDeliveryCommands(p).create(input({ locationId: 12 }))).rejects.toThrow(
      "La finca no pertenece al cliente elegido.",
    );
    await expect(createDeliveryCommands(p).update(3, input({ locationId: 12 }))).rejects.toThrow(DeliveryError);
    expect(p.insertDelivery).not.toHaveBeenCalled();
    expect(p.updateDelivery).not.toHaveBeenCalled();
  });
});

describe("update", () => {
  it("saves the changes", async () => {
    const p = ports();
    await createDeliveryCommands(p).update(3, input({ quantity: 10 }));
    expect(p.updateDelivery).toHaveBeenCalledWith(3, expect.objectContaining({ quantity: 10, plate: "ABC-123", vehicleId: 9 }));
  });

  it("keeps the stored plate and link of a deleted vehicle when the plate is unchanged", async () => {
    const p = ports({ findDelivery: vi.fn(async () => ({ plate: "OLD-111", vehicleId: null })) });
    await createDeliveryCommands(p).update(3, input({ plate: "OLD-111" }));
    expect(p.updateDelivery).toHaveBeenCalledWith(3, expect.objectContaining({ plate: "OLD-111", vehicleId: null }));
  });

  it("refuses a new plate that is not in the fleet", async () => {
    const p = ports({ findDelivery: vi.fn(async () => ({ plate: "OLD-111", vehicleId: null })) });
    await expect(createDeliveryCommands(p).update(3, input({ plate: "ZZZ-999" }))).rejects.toThrow(DeliveryError);
  });

  it("says when the delivery is gone", async () => {
    const missing = ports({ findDelivery: vi.fn(async () => null) });
    await expect(createDeliveryCommands(missing).update(3, input())).rejects.toThrow("La entrega ya no existe.");
    const raced = ports({ updateDelivery: vi.fn(async () => false) });
    await expect(createDeliveryCommands(raced).update(3, input())).rejects.toThrow("La entrega ya no existe.");
  });
});

describe("setStatus", () => {
  it("toggles the status", async () => {
    const p = ports();
    await createDeliveryCommands(p).setStatus(3, "entregado");
    expect(p.setStatus).toHaveBeenCalledWith(3, "entregado");
  });

  it("says when the delivery is gone", async () => {
    const p = ports({ setStatus: vi.fn(async () => false) });
    await expect(createDeliveryCommands(p).setStatus(3, "entregado")).rejects.toThrow("La entrega ya no existe.");
  });
});

describe("remove", () => {
  it("deletes and reports a missing delivery", async () => {
    const p = ports();
    await createDeliveryCommands(p).remove(3);
    expect(p.deleteDelivery).toHaveBeenCalledWith(3);
    await expect(createDeliveryCommands(ports({ deleteDelivery: vi.fn(async () => false) })).remove(3)).rejects.toThrow(
      "La entrega ya no existe.",
    );
  });
});
