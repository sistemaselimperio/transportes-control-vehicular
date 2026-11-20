import { describe, expect, it, vi } from "vitest";
import { createDeliveryCommands, createDestinationCommands, DeliveryError, type DeliveryPorts, type DestinationPorts } from "./delivery-commands";
import type { DeliveryInput } from "./delivery-schemas";

const input = (over: Partial<DeliveryInput> = {}): DeliveryInput => ({
  date: "2026-11-18",
  shift: "1er viaje",
  priority: "normal",
  clientId: 4,
  locationId: null,
  destinationId: 7,
  quantity: 40,
  weightKg: 2000,
  plate: null,
  notes: null,
  ...over,
});

function ports(over: Partial<DeliveryPorts> = {}): DeliveryPorts {
  return {
    clientExists: vi.fn(async () => true),
    destinationExists: vi.fn(async () => true),
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
  it("inserts a delivery without vehicle", async () => {
    const p = ports();
    await createDeliveryCommands(p).create(input());
    expect(p.insertDelivery).toHaveBeenCalledWith({ ...input(), plate: null, vehicleId: null });
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

  it("refuses a client or destination that does not exist", async () => {
    const noClient = ports({ clientExists: vi.fn(async () => false) });
    await expect(createDeliveryCommands(noClient).create(input())).rejects.toThrow("El cliente ya no existe.");
    const noDestination = ports({ destinationExists: vi.fn(async () => false) });
    await expect(createDeliveryCommands(noDestination).create(input())).rejects.toThrow("El destino ya no existe.");
    expect(noClient.insertDelivery).not.toHaveBeenCalled();
    expect(noDestination.insertDelivery).not.toHaveBeenCalled();
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
    expect(p.updateDelivery).toHaveBeenCalledWith(3, expect.objectContaining({ quantity: 10, plate: null, vehicleId: null }));
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

function destinationPorts(over: Partial<DestinationPorts> = {}): DestinationPorts {
  return {
    findDestinationIdByName: vi.fn(async () => null),
    insertDestination: vi.fn(async () => undefined),
    renameDestination: vi.fn(async () => true),
    countDeliveries: vi.fn(async () => 0),
    deleteDestination: vi.fn(async () => true),
    ...over,
  };
}

describe("destination commands", () => {
  it("creates a destination with a free name", async () => {
    const p = destinationPorts();
    await createDestinationCommands(p).create({ name: "Susa" });
    expect(p.insertDestination).toHaveBeenCalledWith("Susa");
  });

  it("refuses a duplicate name on create and rename", async () => {
    const p = destinationPorts({ findDestinationIdByName: vi.fn(async () => 2) });
    await expect(createDestinationCommands(p).create({ name: "Susa" })).rejects.toThrow("Ya existe un destino con ese nombre.");
    await expect(createDestinationCommands(p).rename(1, { name: "Susa" })).rejects.toThrow(DeliveryError);
  });

  it("renames ignoring its own name", async () => {
    const p = destinationPorts();
    await createDestinationCommands(p).rename(1, { name: "Susa" });
    expect(p.findDestinationIdByName).toHaveBeenCalledWith("Susa", 1);
    expect(p.renameDestination).toHaveBeenCalledWith(1, "Susa");
  });

  it("blocks the delete while deliveries use the destination", async () => {
    const p = destinationPorts({ countDeliveries: vi.fn(async () => 2) });
    await expect(createDestinationCommands(p).remove(1)).rejects.toThrow(
      "No se puede eliminar: el destino tiene 2 entregas registradas.",
    );
    expect(p.deleteDestination).not.toHaveBeenCalled();
  });

  it("deletes an unused destination", async () => {
    const p = destinationPorts();
    await createDestinationCommands(p).remove(1);
    expect(p.deleteDestination).toHaveBeenCalledWith(1);
  });
});
