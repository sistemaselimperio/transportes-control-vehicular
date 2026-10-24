"use server";

/**
 * Server actions for the vehicle detail page. Each one
 * re-checks the session, parses the form with zod, runs a command use case and
 * revalidates the pages that show vehicle data.
 */
import { revalidatePath } from "next/cache";
import type { ZodType } from "zod";
import { ZodError } from "zod";
import { requireSession } from "@/lib/session";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { RuleError } from "../domain/vehicle-rules";
import { vehicleCommandRepository } from "../infrastructure/vehicle-command-repository";
import { getVehicleActionContext, type VehicleActionContext } from "./vehicle-queries";
import {
  assignDriverSchema,
  oilChangeSchema,
  oilChangeIdSchema,
  plateSchema,
  renewDocumentSchema,
  sellSchema,
  statusSchema,
  technicalDataSchema,
  transferOwnerSchema,
  updateKmSchema,
  updateTaxSchema,
} from "./vehicle-action-schemas";
import { createVehicleCommands, type CommandResult } from "./vehicle-commands";
import type { OwnerTarget } from "./vehicle-ports";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const commands = createVehicleCommands(vehicleCommandRepository, todayInBogota);

function parse<T>(schema: ZodType<T>, data: unknown): T {
  return schema.parse(data);
}

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function run(fn: () => Promise<CommandResult>): Promise<ActionResult> {
  try {
    await requireSession();
    const result = await fn();
    revalidatePath("/flota");
    revalidatePath("/flota/[placa]", "page");
    revalidatePath("/bitacora");
    revalidatePath("/");
    return { ok: true, message: result.message };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos ingresados." };
    }
    if (e instanceof Error && e.message === "No autorizado") {
      return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }
    console.error("vehicle action failed", e);
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }
}

/**
 * Read-only: what the action forms need for one vehicle. Lets the "Hoy" quick
 * actions open a form for any plate without loading every vehicle's context.
 */
export async function loadActionContextAction(plate: string): Promise<VehicleActionContext | null> {
  try {
    await requireSession();
    return await getVehicleActionContext(parse(plateSchema, plate));
  } catch (e) {
    console.error("action context failed", e);
    return null;
  }
}

export async function renewDocumentAction(plate: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = parse(renewDocumentSchema, formValues(fd));
    return commands.renewDocument(parse(plateSchema, plate), {
      type: v.type,
      policyKind: v.policyKind,
      expiresOn: v.expiresOn,
      notApplicable: v.notApplicable,
    });
  });
}

export async function updateTaxAction(plate: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = parse(updateTaxSchema, formValues(fd));
    return commands.updateTax(parse(plateSchema, plate), { kind: v.kind, year: v.year });
  });
}

export async function registerOilChangeAction(plate: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = parse(oilChangeSchema, formValues(fd));
    return commands.registerOilChange(parse(plateSchema, plate), {
      date: v.date,
      km: v.km,
      notes: v.notes,
      price: v.price,
      items: v.items,
      interval: { months: v.intervalMonths, km: v.intervalKm },
    });
  });
}

export async function updateOilChangeAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = parse(oilChangeSchema, formValues(fd));
    return commands.updateOilChange(parse(oilChangeIdSchema, id), {
      date: v.date,
      km: v.km,
      notes: v.notes,
      price: v.price,
      items: v.items,
      interval: { months: v.intervalMonths, km: v.intervalKm },
    });
  });
}

export async function deleteOilChangeAction(id: number): Promise<ActionResult> {
  return run(async () => commands.deleteOilChange(parse(oilChangeIdSchema, id)));
}

export async function updateTechnicalDataAction(plate: string, fd: FormData): Promise<ActionResult> {
  return run(async () =>
    commands.updateTechnicalData(parse(plateSchema, plate), parse(technicalDataSchema, formValues(fd))),
  );
}

export async function updateKmAction(plate: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = parse(updateKmSchema, formValues(fd));
    return commands.updateKm(parse(plateSchema, plate), {
      odometerWorking: !v.odometerBroken,
      km: v.km,
    });
  });
}

export async function changeStatusAction(plate: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = parse(statusSchema, formValues(fd));
    return commands.changeStatus(parse(plateSchema, plate), v.status);
  });
}

export async function assignDriverAction(plate: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = parse(assignDriverSchema, formValues(fd));
    return commands.assignDriver(parse(plateSchema, plate), {
      date: v.date,
      driver:
        v.mode === "existing"
          ? { kind: "existing", id: v.driverId! }
          : { kind: "new", name: v.name!, nationalId: v.nationalId, phone: v.phone },
    });
  });
}

function ownerTarget(v: ReturnType<typeof transferOwnerSchema.parse>): OwnerTarget {
  if (v.owner === "IMPERIO") return { kind: "imperio" };
  if (v.owner === "NEW") return { kind: "new", name: v.newName!, documentNumber: v.newDocument };
  return { kind: "existing", id: Number(v.owner) };
}

export async function transferOwnerAction(plate: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = parse(transferOwnerSchema, formValues(fd));
    return commands.transferOwner(parse(plateSchema, plate), ownerTarget(v), v.date);
  });
}

export async function sellVehicleAction(plate: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = parse(sellSchema, formValues(fd));
    return commands.sellVehicle(parse(plateSchema, plate), {
      date: v.date,
      buyer: v.buyer,
      price: v.price,
      notes: v.notes,
    });
  });
}
