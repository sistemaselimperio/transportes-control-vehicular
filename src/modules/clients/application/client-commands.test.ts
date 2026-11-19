import { describe, expect, it, vi } from "vitest";
import { ClientError, createClientCommands, type ClientPorts } from "./client-commands";
import type { ClientInput } from "./client-schemas";

const input = (over: Partial<ClientInput> = {}): ClientInput => ({
  name: "Agro Ñandú",
  nit: "9001234567",
  phone: null,
  address: null,
  mapsUrl: null,
  notes: null,
  latitude: null,
  longitude: null,
  ...over,
});

function ports(over: Partial<ClientPorts> = {}): ClientPorts {
  return {
    findClientIdByNit: vi.fn(async () => null),
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
