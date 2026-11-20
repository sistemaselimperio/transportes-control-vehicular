import { describe, expect, it, vi } from "vitest";
import {
  ClientError,
  createClientCommands,
  createLocationCommands,
  type ClientPorts,
  type LocationPorts,
} from "./client-commands";
import type { ClientInput, LocationInput } from "./client-schemas";

const input = (over: Partial<ClientInput> = {}): ClientInput => ({
  name: "Agro Ñandú",
  nameKey: "agronandu",
  nit: "9001234567",
  phone: null,
  notes: null,
  ...over,
});

function ports(over: Partial<ClientPorts> = {}): ClientPorts {
  return {
    findClientIdByNit: vi.fn(async () => null),
    findClientIdByNameKey: vi.fn(async () => null),
    insertClient: vi.fn(async () => undefined),
    updateClient: vi.fn(async () => true),
    countDeliveries: vi.fn(async () => 0),
    deleteClient: vi.fn(async () => true),
    ...over,
  };
}

describe("create", () => {
  it("inserts a client", async () => {
    const p = ports();
    await createClientCommands(p).create(input());
    expect(p.insertClient).toHaveBeenCalledWith(input());
  });

  it("refuses a NIT that already belongs to another client", async () => {
    const p = ports({ findClientIdByNit: vi.fn(async () => 9) });
    await expect(createClientCommands(p).create(input())).rejects.toThrow("Ya existe un cliente con ese NIT.");
    expect(p.insertClient).not.toHaveBeenCalled();
  });

  it("refuses a name that already belongs to another client", async () => {
    const p = ports({ findClientIdByNameKey: vi.fn(async () => 9) });
    await expect(createClientCommands(p).create(input())).rejects.toThrow("Ya existe un cliente con ese nombre.");
    expect(p.findClientIdByNameKey).toHaveBeenCalledWith("agronandu", undefined);
    expect(p.insertClient).not.toHaveBeenCalled();
  });

  it("does not look for duplicates when there is no NIT", async () => {
    const p = ports();
    await createClientCommands(p).create(input({ nit: null }));
    expect(p.findClientIdByNit).not.toHaveBeenCalled();
    expect(p.insertClient).toHaveBeenCalled();
  });
});

describe("update", () => {
  it("ignores the client's own NIT", async () => {
    const p = ports();
    await createClientCommands(p).update(4, input());
    expect(p.findClientIdByNit).toHaveBeenCalledWith("9001234567", 4);
    expect(p.updateClient).toHaveBeenCalledWith(4, input());
  });

  it("refuses a NIT held by another client", async () => {
    const p = ports({ findClientIdByNit: vi.fn(async () => 9) });
    await expect(createClientCommands(p).update(4, input())).rejects.toThrow(ClientError);
  });

  it("ignores the client's own name and refuses one held by another client", async () => {
    const own = ports();
    await createClientCommands(own).update(4, input());
    expect(own.findClientIdByNameKey).toHaveBeenCalledWith("agronandu", 4);
    const taken = ports({ findClientIdByNameKey: vi.fn(async () => 9) });
    await expect(createClientCommands(taken).update(4, input())).rejects.toThrow("Ya existe un cliente con ese nombre.");
    expect(taken.updateClient).not.toHaveBeenCalled();
  });

  it("says when the client is gone", async () => {
    const p = ports({ updateClient: vi.fn(async () => false) });
    await expect(createClientCommands(p).update(4, input())).rejects.toThrow("El cliente ya no existe.");
  });
});

describe("remove", () => {
  it("deletes a client without deliveries", async () => {
    const p = ports();
    await createClientCommands(p).remove(4);
    expect(p.deleteClient).toHaveBeenCalledWith(4);
  });

  it("blocks the delete when the client has deliveries", async () => {
    const p = ports({ countDeliveries: vi.fn(async () => 3) });
    await expect(createClientCommands(p).remove(4)).rejects.toThrow(
      "No se puede eliminar: el cliente tiene 3 entregas registradas.",
    );
    expect(p.deleteClient).not.toHaveBeenCalled();
  });

  it("uses the singular for one delivery", async () => {
    const p = ports({ countDeliveries: vi.fn(async () => 1) });
    await expect(createClientCommands(p).remove(4)).rejects.toThrow("tiene 1 entrega registrada.");
  });

  it("says when the client is gone", async () => {
    const p = ports({ deleteClient: vi.fn(async () => false) });
    await expect(createClientCommands(p).remove(4)).rejects.toThrow("El cliente ya no existe.");
  });
});

const location = (over: Partial<LocationInput> = {}): LocationInput => ({
  name: "Finca 1",
  nameKey: "finca1",
  address: null,
  mapsUrl: null,
  latitude: null,
  longitude: null,
  ...over,
});

function locationPorts(over: Partial<LocationPorts> = {}): LocationPorts {
  return {
    clientExists: vi.fn(async () => true),
    findLocationClientId: vi.fn(async () => 4),
    findLocationIdByNameKey: vi.fn(async () => null),
    insertLocation: vi.fn(async () => undefined),
    updateLocation: vi.fn(async () => true),
    deleteLocation: vi.fn(async () => true),
    ...over,
  };
}

describe("locations", () => {
  it("adds a finca to a client", async () => {
    const p = locationPorts();
    await createLocationCommands(p).create(4, location());
    expect(p.insertLocation).toHaveBeenCalledWith(4, location());
  });

  it("refuses a finca for a client that is gone", async () => {
    const p = locationPorts({ clientExists: vi.fn(async () => false) });
    await expect(createLocationCommands(p).create(4, location())).rejects.toThrow("El cliente ya no existe.");
    expect(p.insertLocation).not.toHaveBeenCalled();
  });

  it("refuses a finca name the client already has", async () => {
    const p = locationPorts({ findLocationIdByNameKey: vi.fn(async () => 7) });
    await expect(createLocationCommands(p).create(4, location())).rejects.toThrow(
      "Este cliente ya tiene una finca con ese nombre.",
    );
    expect(p.findLocationIdByNameKey).toHaveBeenCalledWith(4, "finca1", undefined);
    expect(p.insertLocation).not.toHaveBeenCalled();
  });

  it("looks for a duplicate name among the other fincas of the same client when editing", async () => {
    const p = locationPorts();
    await createLocationCommands(p).update(8, location());
    expect(p.findLocationIdByNameKey).toHaveBeenCalledWith(4, "finca1", 8);
    expect(p.updateLocation).toHaveBeenCalledWith(8, location());
  });

  it("refuses to rename onto another finca of the client", async () => {
    const p = locationPorts({ findLocationIdByNameKey: vi.fn(async () => 9) });
    await expect(createLocationCommands(p).update(8, location())).rejects.toThrow(ClientError);
  });

  it("says when the finca is gone", async () => {
    const missing = locationPorts({ findLocationClientId: vi.fn(async () => null) });
    await expect(createLocationCommands(missing).update(8, location())).rejects.toThrow("La finca ya no existe.");
    const raced = locationPorts({ updateLocation: vi.fn(async () => false) });
    await expect(createLocationCommands(raced).update(8, location())).rejects.toThrow("La finca ya no existe.");
    const gone = locationPorts({ deleteLocation: vi.fn(async () => false) });
    await expect(createLocationCommands(gone).remove(8)).rejects.toThrow("La finca ya no existe.");
  });

  it("deletes a finca", async () => {
    const p = locationPorts();
    await createLocationCommands(p).remove(8);
    expect(p.deleteLocation).toHaveBeenCalledWith(8);
  });
});
