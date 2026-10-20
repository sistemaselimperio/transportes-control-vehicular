import { describe, expect, it } from "vitest";
import { createVehicleCommands, type NewVehicleInput } from "./vehicle-commands";
import type { NewVehicleRecord, VehicleCommandRepository, VehicleSnapshot } from "./vehicle-ports";
import { RuleError } from "../domain/vehicle-rules";

const TODAY = "2026-10-17";

const tractor: VehicleSnapshot = {
  id: 5,
  plate: "TRC-500",
  status: "ACTIVE",
  odometerWorking: true,
  currentKm: 1000,
  oilMode: "both",
  oilInterval: { months: 2, km: 10000 },
  ownership: null,
  assignment: null,
};

function setup(existing: VehicleSnapshot[] = [tractor]) {
  const created: NewVehicleRecord[] = [];
  const repo = {
    findByPlates: async (plates: string[]) => existing.filter((v) => plates.includes(v.plate)),
    findClass: async (id: number) =>
      id === 1 ? { id: 1, oilIntervalMonths: 3, oilIntervalKm: 5000 } : null,
    createVehicle: async (record: NewVehicleRecord) => {
      created.push(record);
      return 42;
    },
  } as unknown as VehicleCommandRepository;
  return { commands: createVehicleCommands(repo, () => TODAY), created };
}

function input(overrides: Partial<NewVehicleInput> = {}): NewVehicleInput {
  return {
    plate: "abc 123",
    classId: 1,
    brandLine: "Chevrolet NHR",
    notes: null,
    municipality: "Bogotá",
    serviceType: "PUBLICO",
    status: "ACTIVE",
    oilMode: "both",
    odometerWorking: true,
    currentKm: 20000,
    towingPlate: null,
    owner: null,
    driver: null,
    documents: [],
    tax: null,
    oilChange: null,
    ...overrides,
  };
}

describe("createVehicle", () => {
  it("creates a vehicle with a normalized plate and today's km reading", async () => {
    const { commands, created } = setup();
    const result = await commands.createVehicle(input());
    expect(result).toMatchObject({ id: 42, plate: "ABC-123" });
    expect(created[0].vehicle).toMatchObject({
      plate: "ABC-123",
      classId: 1,
      currentKm: 20000,
      currentKmAt: TODAY,
      towingVehicleId: null,
    });
  });

  it("rejects a plate that already exists", async () => {
    const { commands, created } = setup([{ ...tractor, plate: "ABC-123" }]);
    await expect(commands.createVehicle(input())).rejects.toThrow(RuleError);
    expect(created).toEqual([]);
  });

  it("rejects an unknown class", async () => {
    const { commands } = setup();
    await expect(commands.createVehicle(input({ classId: 9 }))).rejects.toThrow(RuleError);
  });

  it("links a trailer to its towing vehicle", async () => {
    const { commands, created } = setup();
    await commands.createVehicle(input({ plate: "S88490", towingPlate: "trc500" }));
    expect(created[0].vehicle.towingVehicleId).toBe(5);
  });

  it("rejects a missing or sold towing vehicle", async () => {
    await expect(setup().commands.createVehicle(input({ towingPlate: "ZZZ-999" }))).rejects.toThrow(
      RuleError,
    );
    await expect(
      setup([{ ...tractor, status: "SOLD" }]).commands.createVehicle(input({ towingPlate: "TRC-500" })),
    ).rejects.toThrow(RuleError);
  });

  it("passes owner and driver through and rejects future dates", async () => {
    const { commands, created } = setup();
    await commands.createVehicle(
      input({
        owner: { target: { kind: "imperio" }, date: TODAY },
        driver: { target: { kind: "existing", id: 3 }, date: "2026-10-01" },
      }),
    );
    expect(created[0].owner).toEqual({ target: { kind: "imperio" }, fromDate: TODAY });
    expect(created[0].driver).toEqual({ target: { kind: "existing", id: 3 }, fromDate: "2026-10-01" });

    await expect(
      commands.createVehicle(input({ owner: { target: { kind: "imperio" }, date: "2026-12-01" } })),
    ).rejects.toThrow(RuleError);
  });

  it("validates documents and rejects duplicates", async () => {
    const { commands, created } = setup();
    await commands.createVehicle(
      input({
        documents: [
          { type: "SOAT", policyKind: "TR", expiresOn: "2027-01-01", notApplicable: false },
          { type: "TECNO", policyKind: null, expiresOn: "2027-01-01", notApplicable: true },
        ],
      }),
    );
    expect(created[0].documents).toEqual([
      { type: "SOAT", policyKind: null, expiresOn: "2027-01-01", notApplicable: false },
      { type: "TECNO", policyKind: null, expiresOn: null, notApplicable: true },
    ]);

    const soat = { type: "SOAT" as const, policyKind: null, expiresOn: "2027-01-01", notApplicable: false };
    await expect(commands.createVehicle(input({ documents: [soat, soat] }))).rejects.toThrow(RuleError);
    await expect(
      commands.createVehicle(input({ documents: [{ ...soat, expiresOn: null }] })),
    ).rejects.toThrow(RuleError);
  });

  it("requires a year when the tax is paid", async () => {
    const { commands } = setup();
    await expect(
      commands.createVehicle(input({ tax: { kind: "PAID_YEAR", year: null } })),
    ).rejects.toThrow(RuleError);
  });

  it("plans the first oil change from the class interval and raises the km", async () => {
    const { commands, created } = setup();
    await commands.createVehicle(
      input({ oilChange: { date: "2026-10-01", km: 25000, notes: null, interval: null } }),
    );
    expect(created[0].oilChange).toMatchObject({
      date: "2026-10-01",
      km: 25000,
      intervalMonths: 3,
      intervalKm: 5000,
      nextKm: 30000,
    });
    expect(created[0].vehicle).toMatchObject({ currentKm: 25000, currentKmAt: "2026-10-01" });
  });
});
