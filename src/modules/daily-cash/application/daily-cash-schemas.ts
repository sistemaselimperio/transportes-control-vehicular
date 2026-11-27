/** Zod schemas that parse the raw form values (strings) of the daily cash forms. */
import { z } from "zod";
import { dateField, intField } from "@/modules/vehicles/application/vehicle-action-schemas";
import { COMPANIES, MAX_VALUE } from "../domain/voucher-import";

const detailField = (message: string) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim())
    .refine((v) => v !== "", message)
    .refine((v) => v.length <= 200, "El detalle es demasiado largo.");

const valueField = intField("El valor", MAX_VALUE).refine((v): v is number => v !== null && v > 0, "Ingresa un valor mayor a cero.");

export const boxSchema = z.object({
  date: dateField("La fecha"),
  /** Only typed for the earliest box of the user. */
  openingBalance: intField("El saldo inicial"),
});

export const openingBalanceSchema = z.object({
  openingBalance: intField("El saldo inicial").refine((v): v is number => v !== null, "Ingresa el saldo inicial."),
});

export const expenseSchema = z.object({
  company: z.enum(COMPANIES, "Elige la empresa del egreso."),
  detail: detailField("Ingresa el detalle del egreso."),
  value: valueField,
});

export const incomeSchema = z.object({
  detail: detailField("Ingresa el concepto del ingreso."),
  value: valueField,
});

/** Edit of a manual entry: the company is only there for an expense (the command checks it). */
export const entryUpdateSchema = z.object({
  company: z
    .string()
    .default("")
    .transform((v) => (v === "" ? null : v))
    .pipe(z.enum(COMPANIES, "Elige la empresa del egreso.").nullable()),
  detail: detailField("Ingresa el detalle del movimiento."),
  value: valueField,
});

export const idSchema = z.number().int().positive();

/** The arqueo form: one field per denomination, named by it. */
export const countsSchema = z.record(z.string(), z.union([z.string(), z.number()]));

