/** Zod schemas that parse the raw form values (strings) of the petty-cash forms. */
import { z } from "zod";
import { dateField, intField, textField } from "@/modules/vehicles/application/vehicle-action-schemas";
import { RESPONSIBILITY_TYPES } from "../domain/expense";
import { normalizeNit } from "../domain/nit";

const requiredText = (message: string, max: number) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim())
    .refine((v) => v !== "", message)
    .refine((v) => v.length <= max, "El texto es demasiado largo.");

const optionalText = (max: number) => textField.refine((v) => v === null || v.length <= max, "El texto es demasiado largo.");

export const ledgerSchema = z.object({
  date: dateField("La fecha"),
  compenseAmount: intField("El compense").refine((v): v is number => v !== null, "Ingresa el valor del compense."),
  /** Only typed for the very first ledger of the user; later ones open with the previous closing balance. */
  openingBalance: intField("El saldo inicial"),
});

export type LedgerInput = z.infer<typeof ledgerSchema>;

export const expenseSchema = z.object({
  detail: requiredText("Ingresa el detalle del gasto.", 200),
  invoiceNumber: optionalText(60),
  /** Code or reference typed by hand. */
  efk: optionalText(50),
  nit: z
    .string()
    .default("")
    .transform(normalizeNit)
    .refine((v) => /^\d{5,15}$/.test(v), "Ingresa el NIT (entre 5 y 15 dígitos)."),
  /** Name of the supplier that issued the invoice (the NIT's owner). */
  supplierName: optionalText(150),
  /** The party the invoice is billed to: an owner's name or free text. */
  company: optionalText(150),
  responsibilityType: z
    .string()
    .default("")
    .transform((v) => (v === "" ? null : v))
    .pipe(z.enum(RESPONSIBILITY_TYPES, "Tipo de responsabilidad no válido.").nullable()),
  /** A fleet plate / internal code, or free text such as "PLANTA F. MIRAMAR". */
  vehicle: requiredText("Elige el vehículo o escribe el destino del gasto.", 80),
  value: intField("El valor").refine((v): v is number => v !== null && v > 0, "Ingresa un valor mayor a cero."),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export const ledgerIdSchema = z.number().int().positive();
export const expenseIdSchema = z.number().int().positive();
