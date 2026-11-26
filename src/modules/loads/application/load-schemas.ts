/** Zod schema that parses the raw form values (strings) of the load form. */
import { z } from "zod";
import { parseDecimal } from "@/modules/shared/domain/decimal";
import { dateField, textField } from "@/modules/vehicles/application/vehicle-action-schemas";
import { normalizePlate } from "@/modules/vehicles/domain/plate";
import { firstDuplicate } from "../domain/load-lines";
import { LOAD_SUPPLIERS } from "../domain/load-rules";

export const NOTES_MAX = 500;
export const REFERENCE_MAX = 40;
/** An edit keeps the orders of a load; old loads can carry several. */
export const MAX_ORDERS = 200;
export const MAX_PRODUCTS_PER_ORDER = 30;

const ORDERS_INVALID = "Los pedidos del cargue no son válidos.";

/** A required number typed by hand (SIESA, supplier order): trimmed and capped. */
const reference = (missing: string) =>
  z
    .string(missing)
    .default("")
    .transform((v) => v.trim())
    .refine((v) => v !== "", missing)
    .refine((v) => v.length <= REFERENCE_MAX, "El número no puede pasar de 40 caracteres.");

const ORDER_MISSING = "Cada bloque debe pertenecer a un pedido.";
const PRODUCT_MISSING = "Elige el producto de cada línea.";
const TONS_INVALID = "Las toneladas de cada producto deben ser un número mayor que cero.";
const COST_MISSING = "Ingresa el costo total en pesos de cada pedido.";

/** One product of an order inside the load; the form sends the tons as text. */
export const loadProductSchema = z.object({
  /** The catalog product; the command checks that it exists and belongs to the load's supplier. */
  referenceId: z.number(PRODUCT_MISSING).int(PRODUCT_MISSING).positive(PRODUCT_MISSING),
  tons: z
    .string(TONS_INVALID)
    .transform((v) => parseDecimal(v))
    .refine((v): v is number => v !== null && v > 0 && v < 1e7, TONS_INVALID)
    .transform((v) => v as number),
});

const BALANCE_BAGS_INVALID = "Los bultos que se quedan deben ser un número entero mayor que cero.";

/** Whole bags typed as text: a count above zero. */
const bagsField = (message: string) =>
  z
    .string(message)
    .default("")
    .transform((v) => v.trim())
    .refine((v) => /^\d{1,6}$/.test(v) && Number(v) > 0, message)
    .transform(Number);

/** A plate that may be left blank: none then. */
const optionalPlate = z
  .string()
  .default("")
  .transform((v) => (v.trim() === "" ? null : normalizePlate(v)));

/**
 * The bags of an order that the truck does not carry ("Carga incompleta"): the load still records the whole
 * purchase. The command checks the bags against the order and the plate against the fleet.
 */
export const loadBalanceSchema = z.object({
  bags: bagsField(BALANCE_BAGS_INVALID),
  date: dateField("La fecha del saldo"),
  plate: optionalPlate,
});

/** One order of a load: one SIESA number, one supplier order number and one cost for all its products. */
export const loadOrderSchema = z.object({
  orderId: z.number(ORDER_MISSING).int(ORDER_MISSING).positive(ORDER_MISSING),
  siesaNumber: reference("Ingresa el número SIESA de cada pedido."),
  orderNumber: reference("Ingresa el número de pedido proveedor de cada pedido."),
  /** Whole pesos for the whole order; the form types them with "$" and thousands separators. */
  cost: z
    .string(COST_MISSING)
    .transform((v) => v.replace(/[$\s.,]/g, ""))
    .refine((v) => v !== "", COST_MISSING)
    .refine((v) => /^\d{1,13}$/.test(v), "El costo debe ser un valor en pesos, sin decimales.")
    .transform(Number),
  lines: z
    .array(loadProductSchema, ORDERS_INVALID)
    .min(1, "Cada pedido necesita al menos un producto.")
    .max(MAX_PRODUCTS_PER_ORDER, `Un pedido no puede tener más de ${MAX_PRODUCTS_PER_ORDER} productos.`),
  /** The leftover bags to carry later; absent for a complete load. */
  balance: loadBalanceSchema.nullish(),
});

/** The orders travel as one JSON field of the form; neither an order nor a SIESA number can repeat among them. */
const ordersField = z
  .string()
  .default("[]")
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: ORDERS_INVALID });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(loadOrderSchema, ORDERS_INVALID)
      .min(1, "Elige al menos un pedido.")
      .max(MAX_ORDERS, `Un cargue no puede tener más de ${MAX_ORDERS} pedidos.`)
      .superRefine((orders, ctx) => {
        const order = firstDuplicate(orders.map((o) => String(o.orderId)));
        if (order !== null) ctx.addIssue({ code: "custom", message: `El pedido #${order} está repetido en el cargue.` });
        const siesa = firstDuplicate(orders.map((o) => o.siesaNumber));
        if (siesa !== null) ctx.addIssue({ code: "custom", message: `El número SIESA ${siesa} está repetido en el cargue.` });
      }),
  );

export const loadSchema = z.object({
  date: dateField("La fecha"),
  supplier: z.enum(LOAD_SUPPLIERS, "Elige el proveedor."),
  plate: z
    .string()
    .default("")
    .transform((v) => (v.trim() === "" ? "" : normalizePlate(v)))
    .refine((v) => v !== "", "Elige la placa del vehículo."),
  notes: textField.refine((v) => v === null || v.length <= NOTES_MAX, "La observación no puede pasar de 500 caracteres."),
  /** Every order of the load, each with its numbers and the tons of its products. */
  orders: ordersField,
});

/** One supplier part of an order: the numbers and products of the load that will carry it. */
export const loadBlockSchema = loadOrderSchema.omit({ orderId: true }).extend({
  supplier: z.enum(LOAD_SUPPLIERS, "Elige el proveedor."),
});

const BLOCKS_INVALID = "Los proveedores del cargue no son válidos.";

/** The blocks travel as one JSON field; neither a supplier nor a SIESA number can repeat among them. */
const blocksField = z
  .string()
  .default("[]")
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: BLOCKS_INVALID });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(loadBlockSchema, BLOCKS_INVALID)
      .min(1, "Elige al menos un proveedor.")
      .max(LOAD_SUPPLIERS.length, BLOCKS_INVALID)
      .superRefine((blocks, ctx) => {
        const supplier = firstDuplicate(blocks.map((b) => b.supplier));
        if (supplier !== null) ctx.addIssue({ code: "custom", message: `El proveedor ${supplier} está repetido en el cargue.` });
        const siesa = firstDuplicate(blocks.map((b) => b.siesaNumber));
        if (siesa !== null) ctx.addIssue({ code: "custom", message: `El número SIESA ${siesa} está repetido en el cargue.` });
      }),
  );

/** The loads of one order: one per pending supplier, sharing the date, the plate and the notes. */
export const createLoadsSchema = z.object({
  date: dateField("La fecha"),
  orderId: z
    .string()
    .default("")
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, "Elige el pedido."),
  plate: loadSchema.shape.plate,
  notes: loadSchema.shape.notes,
  blocks: blocksField,
});

const FREE_ROWS_INVALID = "Las filas del cargue no son válidas.";
const KG_INVALID = "Los kilos de cada fila deben ser un número entero mayor que cero.";
const VALUE_INVALID = "El valor de cada fila debe ser mayor que cero.";
export const MAX_FREE_ROWS = 50;

/** One SIESA of a free load: its numbers, whole kilos and whole pesos (typed with separators). */
export const freeRowSchema = z.object({
  siesaNumber: reference("Ingresa el número SIESA de cada fila."),
  orderNumber: reference("Ingresa el número de pedido proveedor de cada fila."),
  kg: z
    .string(KG_INVALID)
    .transform((v) => v.trim())
    .refine((v) => /^\d{1,8}$/.test(v) && Number(v) > 0, KG_INVALID)
    .transform(Number),
  cost: z
    .string(VALUE_INVALID)
    .transform((v) => v.replace(/[$\s.,]/g, ""))
    .refine((v) => /^\d{1,13}$/.test(v) && Number(v) > 0, VALUE_INVALID)
    .transform(Number),
});

/** The rows travel as one JSON field; a SIESA number cannot repeat among them. */
const freeRowsField = z
  .string()
  .default("[]")
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: FREE_ROWS_INVALID });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(freeRowSchema, FREE_ROWS_INVALID)
      .min(1, "Agrega al menos un SIESA.")
      .max(MAX_FREE_ROWS, `Un cargue no puede tener más de ${MAX_FREE_ROWS} filas.`)
      .superRefine((rows, ctx) => {
        const siesa = firstDuplicate(rows.map((r) => r.siesaNumber));
        if (siesa !== null) ctx.addIssue({ code: "custom", message: `El número SIESA ${siesa} está repetido en el cargue.` });
      }),
  );

/** A load made without an order: the supplier, the day, the plate and one row per SIESA. */
export const freeLoadSchema = z.object({
  date: dateField("La fecha"),
  supplier: loadSchema.shape.supplier,
  plate: loadSchema.shape.plate,
  notes: loadSchema.shape.notes,
  rows: freeRowsField,
});

export type FreeLoadInput = z.infer<typeof freeLoadSchema>;

export type CreateLoadsInput = z.infer<typeof createLoadsSchema>;
export type LoadBlockInput = CreateLoadsInput["blocks"][number];

export type LoadInput = z.infer<typeof loadSchema>;
export type LoadOrderInput = LoadInput["orders"][number];

export const loadIdSchema = z.number().int().positive();

const isoDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** A trip of a balance; when it leaves bags behind, `nextDate` (and optionally `nextPlate`) schedules the rest. */
export const balanceTripSchema = z.object({
  date: dateField("La fecha del viaje"),
  plate: z
    .string()
    .default("")
    .transform((v) => (v.trim() === "" ? "" : normalizePlate(v)))
    .refine((v) => v !== "", "Elige la placa del viaje."),
  bags: bagsField("Los bultos del viaje deben ser un número entero mayor que cero."),
  nextDate: z
    .string()
    .default("")
    .transform((v) => v.trim())
    .refine((v) => v === "" || isoDay(v), "La fecha del saldo: ingresa una fecha válida.")
    .transform((v) => (v === "" ? null : v)),
  nextPlate: optionalPlate,
});

export type BalanceTripInput = z.infer<typeof balanceTripSchema>;
