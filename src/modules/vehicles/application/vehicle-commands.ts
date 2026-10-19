/**
 * Command use cases for a vehicle. They validate the business rules with the
 * pure domain and delegate persistence to the `VehicleCommandRepository` port,
 * so they are unit-testable with an in-memory fake.
 */
import type { VehicleStatus } from "@/modules/alerts/domain/alert-status";
import type { OilInterval } from "@/modules/maintenance/domain/oil-change";
import { planOilChange } from "@/modules/maintenance/domain/plan-oil-change";
import type { IsoDate } from "@/modules/shared/domain/dates";
import {
  assertCanAssignDriver,
  assertCanChangeStatus,
  assertCanSell,
  assertCanTransfer,
  assertEditable,
  assertKmNotDecreasing,
  closePeriod,
  RuleError,
} from "../domain/vehicle-rules";
import type {
  DocumentRecord,
  DriverTarget,
  OwnerTarget,
  PeriodClose,
  SaleRecord,
  TaxRecord,
  VehicleCommandRepository,
  VehicleSnapshot,
} from "./vehicle-ports";

export interface CommandResult {
  message: string;
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

  return {
    async renewDocument(plate: string, doc: DocumentRecord): Promise<CommandResult> {
      const vehicle = await loadOne(plate);
      assertEditable(vehicle.status);
      if (!doc.notApplicable && !doc.expiresOn) {
        throw new RuleError("Ingresa la fecha de vencimiento o marca «No aplica».");
      }
      if (doc.type === "POLICY" && !doc.policyKind) {
        throw new RuleError("Elige el tipo de póliza (Todo riesgo o RC).");
      }
      await repo.addDocument(vehicle.id, {
        ...doc,
        policyKind: doc.type === "POLICY" ? doc.policyKind : null,
        expiresOn: doc.notApplicable ? null : doc.expiresOn,
      });
      return { message: "Documento actualizado." };
    },

    async updateTax(plate: string, tax: TaxRecord): Promise<CommandResult> {
      const vehicle = await loadOne(plate);
      assertEditable(vehicle.status);
      if (tax.kind === "PAID_YEAR" && tax.year == null) {
        throw new RuleError("Ingresa el año del impuesto pagado.");
      }
      await repo.addTax(vehicle.id, {
        kind: tax.kind,
        year: tax.kind === "PAID_YEAR" ? tax.year : null,
      });
      return { message: "Impuesto actualizado." };
    },

    async registerOilChange(
      plate: string,
      input: { date: IsoDate; km: number | null; notes: string | null; interval: OilInterval },
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
          notes: input.notes,
        },
        plan.newCurrentKm,
      );
      return { message: "Cambio de aceite registrado." };
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
