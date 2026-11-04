import { describe, expect, it, vi } from "vitest";
import { createTripCommands, TripError, type TripPorts } from "./trip-commands";
import type { TripInput } from "./trip-schemas";

const input = (over: Partial<TripInput> = {}): TripInput => ({
  startAt: new Date("2026-03-10T13:30:00.000Z"),
  origin: "Tunja (Boyacá)",
  destination: "Medellín (Antioquia)",
  plate: "ABC-123",
  area: "Cemento",
  status: "programado",
  ...over,
});

function ports(over: Partial<TripPorts> = {}): TripPorts {
  return {
    findVehicleByPlate: vi.fn(async (plate: string) => (plate === "ABC-123" ? { id: 7, plate: "ABC-123" } : null)),
    findTrip: vi.fn(async () => ({ id: 1, plate: "ABC-123", vehicleId: 7, status: "programado" as const })),
    insertTrip: vi.fn(async () => undefined),
    updateTrip: vi.fn(async () => true),
    deleteTrip: vi.fn(async () => true),
    ...over,
  };
}

describe("create", () => {
  it("stores the registered plate and links the vehicle", async () => {
    const p = ports();
    await createTripCommands(p).create(input());
    expect(p.insertTrip).toHaveBeenCalledWith(expect.objectContaining({ plate: "ABC-123", vehicleId: 7 }));
  });

  it("refuses a plate that is not in the fleet", async () => {
    const p = ports();
    await expect(createTripCommands(p).create(input({ plate: "ZZZ-999" }))).rejects.toThrow(TripError);
    expect(p.insertTrip).not.toHaveBeenCalled();
  });
});

describe("update", () => {
  it("saves the changes", async () => {
    const p = ports();
    await createTripCommands(p).update(1, input({ status: "en_ruta" }));
    expect(p.updateTrip).toHaveBeenCalledWith(1, "programado", expect.objectContaining({ status: "en_ruta", vehicleId: 7 }));
  });

  it("refuses to save when someone else changed the status meanwhile", async () => {
    const p = ports({ updateTrip: vi.fn(async () => false) });
    await expect(createTripCommands(p).update(1, input({ status: "en_ruta" }))).rejects.toThrow(/cambió/i);
  });

  it("refuses to go backward", async () => {
    const p = ports({ findTrip: vi.fn(async () => ({ id: 1, plate: "ABC-123", vehicleId: 7, status: "entregado" as const })) });
    await expect(createTripCommands(p).update(1, input({ status: "en_ruta" }))).rejects.toThrow(/estado/i);
    expect(p.updateTrip).not.toHaveBeenCalled();
  });

  it("lets a delivered trip keep its status while other fields change", async () => {
    const p = ports({ findTrip: vi.fn(async () => ({ id: 1, plate: "ABC-123", vehicleId: 7, status: "entregado" as const })) });
    await createTripCommands(p).update(1, input({ status: "entregado", destination: "Otra parte" }));
    expect(p.updateTrip).toHaveBeenCalled();
  });

  it("fails when the trip no longer exists", async () => {
    const p = ports({ findTrip: vi.fn(async () => null) });
    await expect(createTripCommands(p).update(1, input())).rejects.toThrow(/ya no existe/);
  });

  it("keeps the stored plate when its vehicle was deleted and the plate is unchanged", async () => {
    const p = ports({
      findVehicleByPlate: vi.fn(async () => null),
      findTrip: vi.fn(async () => ({ id: 1, plate: "OLD-111", vehicleId: null, status: "programado" as const })),
    });
    await createTripCommands(p).update(1, input({ plate: "OLD-111" }));
    expect(p.updateTrip).toHaveBeenCalledWith(1, "programado", expect.objectContaining({ plate: "OLD-111", vehicleId: null }));
  });

  it("refuses another unregistered plate", async () => {
    const p = ports({
      findVehicleByPlate: vi.fn(async () => null),
      findTrip: vi.fn(async () => ({ id: 1, plate: "OLD-111", vehicleId: null, status: "programado" as const })),
    });
    await expect(createTripCommands(p).update(1, input({ plate: "NEW-222" }))).rejects.toThrow(TripError);
  });
});

describe("remove", () => {
  it("deletes the trip", async () => {
    const p = ports();
    await createTripCommands(p).remove(1);
    expect(p.deleteTrip).toHaveBeenCalledWith(1);
  });

  it("fails when it no longer exists", async () => {
    const p = ports({ deleteTrip: vi.fn(async () => false) });
    await expect(createTripCommands(p).remove(1)).rejects.toThrow(/ya no existe/);
  });
});
