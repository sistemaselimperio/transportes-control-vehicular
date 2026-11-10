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
  notes: null,
  ...over,
});

/** Two hours after the default input's start: still inside the 12 hours. */
const NOW = new Date("2026-03-10T15:30:00.000Z");
const commands = (p: TripPorts, now: Date = NOW) => createTripCommands(p, () => now);
const STORED_START = new Date("2026-03-10T13:30:00.000Z");
const stored = (status: "programado" | "entregado", startAt: Date = STORED_START) => ({
  id: 1,
  plate: "ABC-123",
  vehicleId: 7,
  status,
  startAt,
});

function ports(over: Partial<TripPorts> = {}): TripPorts {
  return {
    findVehicleByPlate: vi.fn(async (plate: string) => (plate === "ABC-123" ? { id: 7, plate: "ABC-123" } : null)),
    findTrip: vi.fn(async () => stored("programado")),
    insertTrip: vi.fn(async () => undefined),
    updateTrip: vi.fn(async () => true),
    deleteTrip: vi.fn(async () => true),
    ...over,
  };
}

describe("create", () => {
  it("stores the registered plate and links the vehicle", async () => {
    const p = ports();
    await commands(p).create(input());
    expect(p.insertTrip).toHaveBeenCalledWith(expect.objectContaining({ plate: "ABC-123", vehicleId: 7 }));
  });

  it("refuses a plate that is not in the fleet", async () => {
    const p = ports();
    await expect(commands(p).create(input({ plate: "ZZZ-999" }))).rejects.toThrow(TripError);
    expect(p.insertTrip).not.toHaveBeenCalled();
  });
});

describe("create status", () => {
  it("stores a trip that started more than 12 hours ago as delivered", async () => {
    const p = ports();
    await commands(p).create(input({ startAt: new Date("2026-03-09T13:30:00.000Z") }));
    expect(p.insertTrip).toHaveBeenCalledWith(expect.objectContaining({ status: "entregado" }));
  });

  it("keeps a recent trip programado", async () => {
    const p = ports();
    await commands(p).create(input());
    expect(p.insertTrip).toHaveBeenCalledWith(expect.objectContaining({ status: "programado" }));
  });
});

describe("update", () => {
  it("saves the changes", async () => {
    const p = ports();
    await commands(p).update(1, input({ status: "entregado" }));
    expect(p.updateTrip).toHaveBeenCalledWith(1, "programado", expect.objectContaining({ status: "entregado", vehicleId: 7 }));
  });

  it("refuses to save when someone else changed the status meanwhile", async () => {
    const p = ports({ updateTrip: vi.fn(async () => false) });
    await expect(commands(p).update(1, input({ status: "entregado" }))).rejects.toThrow(/cambió/i);
  });

  it("refuses to go backward", async () => {
    const p = ports({ findTrip: vi.fn(async () => stored("entregado")) });
    await expect(commands(p).update(1, input({ status: "programado" }))).rejects.toThrow(/estado/i);
    expect(p.updateTrip).not.toHaveBeenCalled();
  });

  it("lets a trip delivered automatically be edited without a false conflict, and stores it delivered", async () => {
    const oldStart = new Date("2026-03-09T13:30:00.000Z");
    const p = ports({ findTrip: vi.fn(async () => stored("programado", oldStart)) });
    await commands(p).update(1, input({ startAt: oldStart, status: "entregado", destination: "Otra parte" }));
    // The guard compares the STORED status (programado), not the derived one.
    expect(p.updateTrip).toHaveBeenCalledWith(1, "programado", expect.objectContaining({ status: "entregado" }));
  });

  it("refuses to take an automatically delivered trip back to programado", async () => {
    const oldStart = new Date("2026-03-09T13:30:00.000Z");
    const p = ports({ findTrip: vi.fn(async () => stored("programado", oldStart)) });
    await expect(commands(p).update(1, input({ startAt: oldStart, status: "programado" }))).rejects.toThrow(/estado/i);
    expect(p.updateTrip).not.toHaveBeenCalled();
  });

  it("persists entregado when the saved start is already 12 hours behind", async () => {
    const p = ports();
    await commands(p).update(1, input({ startAt: new Date("2026-03-09T13:30:00.000Z"), status: "programado" }));
    expect(p.updateTrip).toHaveBeenCalledWith(1, "programado", expect.objectContaining({ status: "entregado" }));
  });

  it("lets a delivered trip keep its status while other fields change", async () => {
    const p = ports({ findTrip: vi.fn(async () => stored("entregado")) });
    await commands(p).update(1, input({ status: "entregado", destination: "Otra parte" }));
    expect(p.updateTrip).toHaveBeenCalled();
  });

  it("fails when the trip no longer exists", async () => {
    const p = ports({ findTrip: vi.fn(async () => null) });
    await expect(commands(p).update(1, input())).rejects.toThrow(/ya no existe/);
  });

  it("keeps the stored plate when its vehicle was deleted and the plate is unchanged", async () => {
    const p = ports({
      findVehicleByPlate: vi.fn(async () => null),
      findTrip: vi.fn(async () => ({ ...stored("programado"), plate: "OLD-111", vehicleId: null })),
    });
    await commands(p).update(1, input({ plate: "OLD-111" }));
    expect(p.updateTrip).toHaveBeenCalledWith(1, "programado", expect.objectContaining({ plate: "OLD-111", vehicleId: null }));
  });

  it("refuses another unregistered plate", async () => {
    const p = ports({
      findVehicleByPlate: vi.fn(async () => null),
      findTrip: vi.fn(async () => ({ ...stored("programado"), plate: "OLD-111", vehicleId: null })),
    });
    await expect(commands(p).update(1, input({ plate: "NEW-222" }))).rejects.toThrow(TripError);
  });
});

describe("remove", () => {
  it("deletes the trip", async () => {
    const p = ports();
    await commands(p).remove(1);
    expect(p.deleteTrip).toHaveBeenCalledWith(1);
  });

  it("fails when it no longer exists", async () => {
    const p = ports({ deleteTrip: vi.fn(async () => false) });
    await expect(commands(p).remove(1)).rejects.toThrow(/ya no existe/);
  });
});
