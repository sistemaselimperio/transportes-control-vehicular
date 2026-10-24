/**
 * Command use cases for a vehicle. They validate the business rules with the
 * pure domain and delegate persistence to the `VehicleCommandRepository` port,
 * so they are unit-testable with an in-memory fake.
 */
import type { VehicleStatus } from "@/modules/alerts/domain/alert-status";
import type { OilInterval, OilMode } from "@/modules/maintenance/domain/oil-change";
import type { OilItem } from "@/modules/maintenance/domain/oil-items";
import { planOilChange } from "@/modules/maintenance/domain/plan-oil-change";
import type { IsoDate } from "@/modules/shared/domain/dates";
import { normalizePlate } from "../domain/plate";
import {
  assertCanAssignDriver,
  assertCanChangeStatus,
  assertCanSell,
  assertCanTransfer,
  assertEditable,
  assertKmNotDecreasing,
  assertNotFuture,
  closePeriod,
  RuleError,
} from "../domain/vehicle-rules";
import type {
  DocumentRecord,
  DriverTarget,
  NewVehicleRecord,
  OilChangeRecord,
  OwnerTarget,
  PeriodClose,
  SaleRecord,
  TaxRecord,
  VehicleCommandRepository,
  VehicleSnapshot,
  VehicleUpdate,
} from "./vehicle-ports";

export interface CommandResult {
  message: string;
}

export interface NewVehicleInput {
  plate: string;
  classId: number;
  brandLine: string | null;
  notes: string | null;
  municipality: string | null;
  serviceType: "PARTICULAR" | "PUBLICO";
  status: "ACTIVE" | "IDLE" | "IN_WORKSHOP";
  oilMode: OilMode;
  odometerWorking: boolean;
  currentKm: number | null;
  /** Tractor unit pulling this vehicle (trailers only). */
  towingPlate: string | null;
  owner: { target: OwnerTarget; date: IsoDate } | null;
  driver: { target: DriverTarget; date: IsoDate } | null;
  documents: DocumentRecord[];
  tax: TaxRecord | null;
  /** `interval` null uses the class default. */
  oilChange: {
    date: IsoDate;
    km: number | null;
    notes: string | null;
    interval: OilInterval | null;
  } | null;
}

/** Editable vehicle data; absent keys stay as they are, `towingPlate: null` unlinks. */
export type VehicleEdit = Partial<
  Pick<
    NewVehicleInput,
    | "plate"
    | "classId"
    | "brandLine"
    | "notes"
    | "municipality"
    | "serviceType"
    | "oilMode"
    | "towingPlate"
  >
>;

function parsePlate(raw: string): string {
  try {
    return normalizePlate(raw);
  } catch {
    throw new RuleError("Ingresa la placa.");
  }
}

/** Validates a document and drops the fields that do not apply to it. */
function cleanDocument(doc: DocumentRecord): DocumentRecord {
  if (!doc.notApplicable && !doc.expiresOn) {
    throw new RuleError("Ingresa la fecha de vencimiento o marca «No aplica».");
  }
  if (doc.type === "POLICY" && !doc.policyKind) {
    throw new RuleError("Elige el tipo de póliza (Todo riesgo o RC).");
  }
  return {
    ...doc,
    policyKind: doc.type === "POLICY" ? doc.policyKind : null,
    expiresOn: doc.notApplicable ? null : doc.expiresOn,
  };
}

function cleanTax(tax: TaxRecord): TaxRecord {
  if (tax.kind === "PAID_YEAR" && tax.year == null) {
    throw new RuleError("Ingresa el año del impuesto pagado.");
  }
  return { kind: tax.kind, year: tax.kind === "PAID_YEAR" ? tax.year : null };
}

function closeOf(
  open: { id: number; fromDate: IsoDate } | null,
  date: IsoDate,
): PeriodClose | null {
  return open ? { id: open.id, ...closePeriod(open.fromDate, date) } : null;
}

export function createVehicleCommands(
  repo: VehicleCommandRepository,
  today: () => IsoDate,
) {
  async function loadOne(plate: string): Promise<VehicleSnapshot> {
    const [vehicle] = await repo.findByPlates([plate]);
    if (!vehicle) throw new RuleError(`El vehículo ${plate} no existe.`);
    return vehicle;
  }

  /** The vehicle of an existing oil change, which must still accept changes. */
  async function loadOilChangeVehicle(oilChangeId: number): Promise<VehicleSnapshot> {
    const vehicle = await repo.findOilChangeVehicle(oilChangeId);
    if (!vehicle) throw new RuleError("El cambio de aceite ya no existe.");
    assertEditable(vehicle.status);
    return vehicle;
  }

  return {
    async createVehicle(input: NewVehicleInput): Promise<CommandResult & { id: number; plate: string }> {
      const plate = parsePlate(input.plate);
      if ((await repo.findByPlates([plate])).length > 0) {
        throw new RuleError(`Ya existe un vehículo con la placa ${plate}.`);
      }
      const cls = await repo.findClass(input.classId);
      if (!cls) throw new RuleError("La clase de vehículo no existe.");

      let towingVehicleId: number | null = null;
      if (input.towingPlate) {
        const towing = await loadOne(normalizePlate(input.towingPlate));
        assertEditable(towing.status);
        towingVehicleId = towing.id;
      }

      if (input.owner) assertNotFuture(input.owner.date, today());
      if (input.driver) assertNotFuture(input.driver.date, today());

      const documents = input.documents.map(cleanDocument);
      const keys = documents.map((d) => `${d.type}:${d.policyKind ?? ""}`);
      if (new Set(keys).size !== keys.length) {
        throw new RuleError("Hay documentos repetidos.");
      }

      let currentKm = input.currentKm;
      let currentKmAt = currentKm != null ? today() : null;
      let oilChange: OilChangeRecord | null = null;
      if (input.oilChange) {
        const oil = input.oilChange;
        const plan = planOilChange({
          date: oil.date,
          km: oil.km,
          today: today(),
          vehicle: { odometerWorking: input.odometerWorking, currentKm, oilMode: input.oilMode },
          interval: oil.interval ?? { months: cls.oilIntervalMonths, km: cls.oilIntervalKm },
        });
        oilChange = {
          date: oil.date,
          km: oil.km,
          intervalMonths: plan.intervalMonths,
          intervalKm: plan.intervalKm,
          nextDate: plan.nextDate,
          nextKm: plan.nextKm,
          price: null,
          notes: oil.notes,
        };
        if (plan.newCurrentKm != null) {
          currentKm = plan.newCurrentKm;
          currentKmAt = oil.date;
        }
      }

      const record: NewVehicleRecord = {
        vehicle: {
          plate,
          classId: cls.id,
          brandLine: input.brandLine,
          notes: input.notes,
          municipality: input.municipality,
          serviceType: input.serviceType,
          status: input.status,
          oilMode: input.oilMode,
          odometerWorking: input.odometerWorking,
          currentKm,
          currentKmAt,
          towingVehicleId,
        },
        owner: input.owner ? { target: input.owner.target, fromDate: input.owner.date } : null,
        driver: input.driver ? { target: input.driver.target, fromDate: input.driver.date } : null,
        documents,
        tax: input.tax ? cleanTax(input.tax) : null,
        oilChange,
      };
      const id = await repo.createVehicle(record);
      return { id, plate, message: `Vehículo ${plate} creado.` };
    },

    async updateVehicle(
      currentPlate: string,
      edit: VehicleEdit,
    ): Promise<CommandResult & { plate: string }> {
      const vehicle = await loadOne(currentPlate);
      assertEditable(vehicle.status);
      const { towingPlate, ...rest } = edit;
      const fields: VehicleUpdate = { ...rest };

      if (edit.plate !== undefined) {
        fields.plate = parsePlate(edit.plate);
        const [other] = await repo.findByPlates([fields.plate]);
        if (other && other.id !== vehicle.id) {
          throw new RuleError(`Ya existe un vehículo con la placa ${fields.plate}.`);
        }
      }
      if (edit.classId !== undefined && !(await repo.findClass(edit.classId))) {
        throw new RuleError("La clase de vehículo no existe.");
      }
      if (towingPlate !== undefined) {
        if (towingPlate === null) {
          fields.towingVehicleId = null;
        } else {
          const towing = await loadOne(parsePlate(towingPlate));
          if (towing.id === vehicle.id) {
            throw new RuleError("Un vehículo no puede remolcarse a sí mismo.");
          }
          assertEditable(towing.status);
          fields.towingVehicleId = towing.id;
        }
      }

      await repo.updateVehicle(vehicle.id, fields);
      const plate = fields.plate ?? vehicle.plate;
      return { plate, message: `Vehículo ${plate} actualizado.` };
    },

    async renewDocument(plate: string, doc: DocumentRecord): Promise<CommandResult> {
      const vehicle = await loadOne(plate);
      assertEditable(vehicle.status);
      await repo.addDocument(vehicle.id, cleanDocument(doc));
      return { message: "Documento actualizado." };
    },

    async updateTax(plate: string, tax: TaxRecord): Promise<CommandResult> {
      const vehicle = await loadOne(plate);
      assertEditable(vehicle.status);
      await repo.addTax(vehicle.id, cleanTax(tax));
      return { message: "Impuesto actualizado." };
    },

    async registerOilChange(
      plate: string,
      input: {
        date: IsoDate;
        km: number | null;
        notes: string | null;
        price: number | null;
        items: OilItem[];
        interval: OilInterval;
      },
    ): Promise<CommandResult> {
      const vehicle = await loadOne(plate);
      assertEditable(vehicle.status);
      const plan = planOilChange({
        date: input.date,
        km: input.km,
        today: today(),
        vehicle,
        interval: input.interval,
      });
      await repo.addOilChange(
        vehicle.id,
        {
          date: input.date,
          km: input.km,
          intervalMonths: plan.intervalMonths,
          intervalKm: plan.intervalKm,
          nextDate: plan.nextDate,
          nextKm: plan.nextKm,
          price: input.price,
          notes: input.notes,
        },
        plan.newCurrentKm,
        input.items,
      );
      return { message: "Cambio de aceite registrado." };
    },
    async updateOilChange(
      oilChangeId: number,
      input: {
        date: IsoDate;
        km: number | null;
        notes: string | null;
        price: number | null;
        items: OilItem[];
        interval: OilInterval;
      },
    ): Promise<CommandResult> {
      const vehicle = await loadOilChangeVehicle(oilChangeId);
      const plan = planOilChange({
        date: input.date,
        km: input.km,
        today: today(),
        vehicle,
        interval: input.interval,
      });
      await repo.updateOilChange(
        oilChangeId,
        vehicle.id,
        {
          date: input.date,
          km: input.km,
          intervalMonths: plan.intervalMonths,
          intervalKm: plan.intervalKm,
          nextDate: plan.nextDate,
          nextKm: plan.nextKm,
          price: input.price,
          notes: input.notes,
        },
        plan.newCurrentKm,
        input.items,
      );
      return { message: "Cambio de aceite actualizado." };
    },
    async deleteOilChange(oilChangeId: number): Promise<CommandResult> {
      await loadOilChangeVehicle(oilChangeId);
      await repo.deleteOilChange(oilChangeId);
      return { message: "Cambio de aceite eliminado." };
    },
    async updateKm(
      plate: string,
      input: { odometerWorking: boolean; km: number | null },
    ): Promise<CommandResult> {
      const vehicle = await loadOne(plate);
      assertEditable(vehicle.status);
      if (input.odometerWorking && input.km == null) {
        throw new RuleError("Ingresa el kilometraje actual.");
      }
      if (input.km != null) assertKmNotDecreasing(vehicle.currentKm, input.km);
      await repo.updateOdometer(vehicle.id, {
        odometerWorking: input.odometerWorking,
        reading: input.km != null ? { km: input.km, at: today() } : null,
      });
      return { message: "Kilometraje actualizado." };
    },

    async changeStatus(plate: string, target: VehicleStatus): Promise<CommandResult> {
      const vehicle = await loadOne(plate);
      assertCanChangeStatus(vehicle.status, target);
      await repo.setStatus(vehicle.id, target);
      return { message: "Estado actualizado." };
    },

    async assignDriver(
      plate: string,
      input: { driver: DriverTarget; date: IsoDate },
    ): Promise<CommandResult> {
      const vehicle = await loadOne(plate);
      assertCanAssignDriver({
        status: vehicle.status,
        currentDriverId: vehicle.assignment?.driverId ?? null,
        targetDriverId: await repo.findDriverId(input.driver),
        date: input.date,
        today: today(),
      });
      await repo.assignDriver({
        vehicleId: vehicle.id,
        driver: input.driver,
        date: input.date,
        close: closeOf(vehicle.assignment, input.date),
      });
      return { message: "Conductor asignado." };
    },

    async transferOwner(plate: string, owner: OwnerTarget, date: IsoDate): Promise<CommandResult> {
      const vehicle = await loadOne(plate);
      assertCanTransfer({
        status: vehicle.status,
        currentOwnerId: vehicle.ownership?.ownerId ?? null,
        targetOwnerId: await repo.findOwnerId(owner),
        date,
        today: today(),
      });
      await repo.transferOwnership({
        vehicleId: vehicle.id,
        owner,
        date,
        close: closeOf(vehicle.ownership, date),
      });
      return { message: "1 vehículo traspasado." };
    },

    async sellVehicle(plate: string, sale: SaleRecord): Promise<CommandResult> {
      const vehicle = await loadOne(plate);
      assertCanSell({ status: vehicle.status, date: sale.date, today: today() });
      await repo.registerSale({
        vehicleId: vehicle.id,
        sale,
        closeOwnership: closeOf(vehicle.ownership, sale.date),
        closeAssignment: closeOf(vehicle.assignment, sale.date),
      });
      return { message: "Venta registrada." };
    },
  };
}

export type VehicleCommands = ReturnType<typeof createVehicleCommands>;
