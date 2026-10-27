import { describe, expect, it } from "vitest";
import { createVehicleCommands } from "./vehicle-commands";
import type { VehicleCommandRepository, VehicleSnapshot } from "./vehicle-ports";
import { RuleError } from "../domain/vehicle-rules";

const TODAY = "2026-10-17";

function snapshot(overrides: Partial<VehicleSnapshot> = {}): VehicleSnapshot {
  return {
    id: 1,
    plate: "AAA-111",
    status: "ACTIVE",
    odometerWorking: true,
    currentKm: 100000,
    oilMode: "both",
    oilInterval: { months: 2, km: 20000 },
    ownership: { id: 10, ownerId: 7, fromDate: "2026-10-17" },
    assignment: { id: 20, driverId: 3, fromDate: "2026-10-17" },
    ...overrides,
  };
}

/** In-memory fake that records every write call. */
function fakeRepo(vehicles: VehicleSnapshot[], imperioId: number | null = 99, oilChangeOwners: Record<number, number> = {}) {
  const calls: Array<{ op: string; args: unknown }> = [];
  const record = (op: string) => async (args: unknown) => {
    calls.push({ op, args });
  };
  const repo: VehicleCommandRepository = {
    findByPlates: async (plates) => vehicles.filter((v) => plates.includes(v.plate)),
    findOwnerId: async (t) =>
      t.kind === "existing" ? t.id : t.kind === "imperio" ? imperioId : null,
    findDriverId: async (t) => (t.kind === "existing" ? t.id : null),
    findClass: async () => null,
    createVehicle: async () => 0,
    updateVehicle: async () => {},
    addDocument: async (id, doc) => void calls.push({ op: "addDocument", args: { id, doc } }),
    addTax: async (id, tax) => void calls.push({ op: "addTax", args: { id, tax } }),
    addOilChange: async (id, oil, km, items) =>
      void calls.push({ op: "addOilChange", args: { id, oil, km, items } }),
    findOilChangeVehicle: async (oilId) => vehicles.find((v) => v.id === oilChangeOwners[oilId]) ?? null,
    updateOilChange: async (id, vehicleId, oil, km, items) =>
      void calls.push({ op: "updateOilChange", args: { id, vehicleId, oil, km, items } }),
    deleteOilChange: async (id) => void calls.push({ op: "deleteOilChange", args: { id } }),
    updateOdometer: async (id, o) => void calls.push({ op: "updateOdometer", args: { id, o } }),
    setStatus: async (id, s) => void calls.push({ op: "setStatus", args: { id, s } }),
    assignDriver: record("assignDriver"),
    transferOwnership: record("transferOwnership"),
    registerSale: record("registerSale"),
    deleteAllVehicles: async () => {
      calls.push({ op: "deleteAllVehicles", args: {} });
      return vehicles.length;
    },
  };
  return { repo, calls };
}

const commands = (vehicles: VehicleSnapshot[], imperioId?: number | null, oilChangeOwners?: Record<number, number>) => {
  const { repo, calls } = fakeRepo(vehicles, imperioId, oilChangeOwners);
  return { ...createVehicleCommands(repo, () => TODAY), calls };
};

describe("deleteAllVehicles", () => {
  it("removes every vehicle in one repository call and reports how many", async () => {
    const c = commands([snapshot(), snapshot({ id: 2, plate: "BBB-222" })]);
    const result = await c.deleteAllVehicles();
    expect(c.calls).toEqual([{ op: "deleteAllVehicles", args: {} }]);
    expect(result.message).toBe("Se eliminaron 2 vehículos.");
  });

  it("uses the singular for one vehicle", async () => {
    const c = commands([snapshot()]);
    expect((await c.deleteAllVehicles()).message).toBe("Se eliminó 1 vehículo.");
  });

  it("rejects when there is nothing to delete", async () => {
    const c = commands([]);
    await expect(c.deleteAllVehicles()).rejects.toThrow(RuleError);
  });
});

describe("sellVehicle", () => {
  it("registers the sale closing ownership and driver", async () => {
    const c = commands([snapshot()]);
    await c.sellVehicle("AAA-111", { date: "2026-10-10", buyer: "Juan", price: 5000000, notes: null });
    expect(c.calls).toEqual([
      {
        op: "registerSale",
        args: {
          vehicleId: 1,
          sale: { date: "2026-10-10", buyer: "Juan", price: 5000000, notes: null },
          closeOwnership: { id: 10, fromDate: "2026-10-10", toDate: "2026-10-10" },
          closeAssignment: { id: 20, fromDate: "2026-10-10", toDate: "2026-10-10" },
        },
      },
    ]);
  });

  it("rejects an already sold vehicle without writing", async () => {
    const c = commands([snapshot({ status: "SOLD" })]);
    await expect(
      c.sellVehicle("AAA-111", { date: TODAY, buyer: null, price: null, notes: null }),
    ).rejects.toThrow(RuleError);
    expect(c.calls).toEqual([]);
  });

  it("rejects unknown plates", async () => {
    const c = commands([]);
    await expect(
      c.sellVehicle("ZZZ-999", { date: TODAY, buyer: null, price: null, notes: null }),
    ).rejects.toThrow(/no existe/i);
  });
});

describe("transferOwner", () => {
  it("closes the current ownership and opens the new one in a single repository call", async () => {
    const c = commands([snapshot()]);
    await c.transferOwner("AAA-111", { kind: "imperio" }, TODAY);
    expect(c.calls).toEqual([
      {
        op: "transferOwnership",
        args: {
          vehicleId: 1,
          owner: { kind: "imperio" },
          date: TODAY,
          close: { id: 10, fromDate: "2026-10-17", toDate: TODAY },
        },
      },
    ]);
  });

  it("rejects transferring to the current owner", async () => {
    const c = commands([snapshot()]);
    await expect(
      c.transferOwner("AAA-111", { kind: "existing", id: 7 }, TODAY),
    ).rejects.toThrow(RuleError);
    expect(c.calls).toEqual([]);
  });

  it("rejects a sold vehicle", async () => {
    const c = commands([snapshot({ status: "SOLD" })]);
    await expect(c.transferOwner("AAA-111", { kind: "imperio" }, TODAY)).rejects.toThrow(RuleError);
    expect(c.calls).toEqual([]);
  });

  it("rejects an unknown plate", async () => {
    const c = commands([]);
    await expect(c.transferOwner("NOPE-1", { kind: "imperio" }, TODAY)).rejects.toThrow(/no existe/i);
  });
});

describe("registerOilChange", () => {
  it("records the change and raises the current km", async () => {
    const c = commands([snapshot()]);
    await c.registerOilChange("AAA-111", {
      date: "2026-10-01",
      km: 105000,
      notes: "Filtro",
      price: 350000,
      items: [{ quantity: 48, detail: "CUARTOS DELO 15W40" }],
      interval: { months: 2, km: 20000 },
    });
    expect(c.calls).toEqual([
      {
        op: "addOilChange",
        args: {
          id: 1,
          oil: {
            date: "2026-10-01",
            km: 105000,
            intervalMonths: 2,
            intervalKm: 20000,
            nextDate: "2026-12-01",
            nextKm: 125000,
            price: 350000,
            notes: "Filtro",
          },
          km: 105000,
          items: [{ quantity: 48, detail: "CUARTOS DELO 15W40" }],
        },
      },
    ]);
  });

  it("rejects sold vehicles", async () => {
    const c = commands([snapshot({ status: "SOLD" })]);
    await expect(
      c.registerOilChange("AAA-111", {
        date: TODAY,
        km: 1,
        notes: null,
        price: null,
        items: [],
        interval: { months: 2, km: 1 },
      }),
    ).rejects.toThrow(RuleError);
  });
});

describe("updateOilChange", () => {
  const edit = {
    date: "2026-10-01",
    km: 105000,
    notes: null,
    price: null,
    items: [{ quantity: 1, detail: "FILTRO" }],
    interval: { months: 3, km: 10000 },
  };

  it("recomputes the next change and replaces the supplies", async () => {
    const c = commands([snapshot()], 99, { 7: 1 });
    const result = await c.updateOilChange(7, edit);
    expect(result.message).toBe("Cambio de aceite actualizado.");
    expect(c.calls).toEqual([
      {
        op: "updateOilChange",
        args: {
          id: 7,
          vehicleId: 1,
          oil: {
            date: "2026-10-01",
            km: 105000,
            intervalMonths: 3,
            intervalKm: 10000,
            nextDate: "2027-01-01",
            nextKm: 115000,
            price: null,
            notes: null,
          },
          km: 105000,
          items: [{ quantity: 1, detail: "FILTRO" }],
        },
      },
    ]);
  });

  it("rejects an oil change that no longer exists", async () => {
    const c = commands([snapshot()]);
    await expect(c.updateOilChange(7, edit)).rejects.toThrow(/ya no existe/);
  });

  it("rejects sold vehicles", async () => {
    const c = commands([snapshot({ status: "SOLD" })], 99, { 7: 1 });
    await expect(c.updateOilChange(7, edit)).rejects.toThrow(RuleError);
  });

  it("rejects a future date", async () => {
    const c = commands([snapshot()], 99, { 7: 1 });
    await expect(c.updateOilChange(7, { ...edit, date: "2026-12-01" })).rejects.toThrow(RuleError);
  });
});

describe("deleteOilChange", () => {
  it("removes the oil change", async () => {
    const c = commands([snapshot()], 99, { 7: 1 });
    expect((await c.deleteOilChange(7)).message).toBe("Cambio de aceite eliminado.");
    expect(c.calls).toEqual([{ op: "deleteOilChange", args: { id: 7 } }]);
  });

  it("rejects an oil change that no longer exists", async () => {
    const c = commands([snapshot()]);
    await expect(c.deleteOilChange(7)).rejects.toThrow(/ya no existe/);
  });

  it("rejects sold vehicles", async () => {
    const c = commands([snapshot({ status: "SOLD" })], 99, { 7: 1 });
    await expect(c.deleteOilChange(7)).rejects.toThrow(RuleError);
  });
});

describe("updateKm", () => {
  it("stores a higher reading", async () => {
    const c = commands([snapshot()]);
    await c.updateKm("AAA-111", { odometerWorking: true, km: 120000 });
    expect(c.calls).toEqual([
      {
        op: "updateOdometer",
        args: { id: 1, o: { odometerWorking: true, reading: { km: 120000, at: TODAY } } },
      },
    ]);
  });

  it("rejects a lower reading", async () => {
    const c = commands([snapshot()]);
    await expect(c.updateKm("AAA-111", { odometerWorking: true, km: 5 })).rejects.toThrow(
      /menor/,
    );
  });

  it("requires km while the odometer works", async () => {
    const c = commands([snapshot()]);
    await expect(c.updateKm("AAA-111", { odometerWorking: true, km: null })).rejects.toThrow(
      RuleError,
    );
  });

  it("can flag a broken odometer without a reading", async () => {
    const c = commands([snapshot()]);
    await c.updateKm("AAA-111", { odometerWorking: false, km: null });
    expect(c.calls[0].args).toMatchObject({ o: { odometerWorking: false, reading: null } });
  });
});

describe("changeStatus", () => {
  it("updates the status", async () => {
    const c = commands([snapshot()]);
    await c.changeStatus("AAA-111", "IDLE");
    expect(c.calls).toEqual([{ op: "setStatus", args: { id: 1, s: "IDLE" } }]);
  });
  it("rejects the same status", async () => {
    const c = commands([snapshot()]);
    await expect(c.changeStatus("AAA-111", "ACTIVE")).rejects.toThrow(RuleError);
  });
});

describe("assignDriver", () => {
  it("closes the previous assignment and opens the new one", async () => {
    const c = commands([snapshot()]);
    await c.assignDriver("AAA-111", { driver: { kind: "existing", id: 4 }, date: TODAY });
    expect(c.calls[0].args).toMatchObject({
      vehicleId: 1,
      driver: { kind: "existing", id: 4 },
      close: { id: 20, toDate: TODAY },
    });
  });
  it("rejects the driver already assigned", async () => {
    const c = commands([snapshot()]);
    await expect(
      c.assignDriver("AAA-111", { driver: { kind: "existing", id: 3 }, date: TODAY }),
    ).rejects.toThrow(RuleError);
  });
});

describe("renewDocument and updateTax", () => {
  it("rejects a document without date unless not applicable", async () => {
    const c = commands([snapshot()]);
    await expect(
      c.renewDocument("AAA-111", { type: "SOAT", policyKind: null, expiresOn: null, notApplicable: false }),
    ).rejects.toThrow(RuleError);
    await c.renewDocument("AAA-111", { type: "SOAT", policyKind: null, expiresOn: null, notApplicable: true });
    expect(c.calls).toHaveLength(1);
  });

  it("requires a year when the tax is paid", async () => {
    const c = commands([snapshot()]);
    await expect(c.updateTax("AAA-111", { kind: "PAID_YEAR", year: null })).rejects.toThrow(
      RuleError,
    );
  });
});

describe("updateTechnicalData", () => {
  const data = {
    registrationDate: "2020-09-28",
    modelYear: 2021,
    engineNumber: "80236366",
    chassisNumber: "727121",
    serialNumber: "727121",
    bodyType: "SRS",
    fuelType: "DIESEL",
    capacity: null,
    engineDisplacement: 14900,
    grossWeightKg: 52000,
    color: "BLANCO",
  };

  it("saves the technical data of the vehicle", async () => {
    const updates: unknown[] = [];
    const { repo } = fakeRepo([snapshot()]);
    repo.updateVehicle = async (id, fields) => void updates.push({ id, fields });
    const result = await createVehicleCommands(repo, () => TODAY).updateTechnicalData("AAA-111", data);
    expect(updates).toEqual([{ id: 1, fields: data }]);
    expect(result.message).toMatch(/datos técnicos/i);
  });

  it("rejects a sold vehicle", async () => {
    const c = commands([snapshot({ status: "SOLD" })]);
    await expect(c.updateTechnicalData("AAA-111", data)).rejects.toThrow(RuleError);
  });

  it("rejects an unknown plate and an out of range model year", async () => {
    await expect(commands([]).updateTechnicalData("ZZZ-999", data)).rejects.toThrow(/no existe/i);
    await expect(
      commands([snapshot()]).updateTechnicalData("AAA-111", { ...data, modelYear: 1800 }),
    ).rejects.toThrow(/modelo/i);
  });
});
