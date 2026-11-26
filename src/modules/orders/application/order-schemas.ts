/** Zod schemas that parse the raw values of the order form and of the kg-per-bag field. */
import { z } from "zod";
import { parseDecimal } from "@/modules/shared/domain/decimal";
import { dateField, textField } from "@/modules/vehicles/application/vehicle-action-schemas";
import { isValidKgPerBag } from "../domain/order-rules";

export const NOTE_MAX = 500;
export const TIME_WINDOW_MAX = 40;
export const MAX_LINES = 100;

const ORDER_INVALID = "Los datos del pedido no son válidos.";
const PRODUCT_MISSING = "Elige la referencia de cada producto.";
const BAGS_INVALID = "Los bultos de cada producto deben ser un número entero mayor que cero.";
export const DUPLICATE_PRODUCT = "Un producto no puede repetirse en el pedido.";

/** A product row of the order: the catalog product (the command checks it exists) and its bags. */
const productLineSchema = z.object({
  referenceId: z.number(PRODUCT_MISSING).int(PRODUCT_MISSING).positive(PRODUCT_MISSING),
  bags: z
    .number(BAGS_INVALID)
    .int(BAGS_INVALID)
    .positive(BAGS_INVALID)
    .max(1_000_000, "Los bultos de un producto no pueden pasar de 1.000.000."),
});

/**
 * An order has one client and, optionally, one finca (the command checks it belongs to the client),
 * with the products below them. They travel as one JSON field of the form.
 */
const orderField = z
  .string()
  .default("{}")
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: ORDER_INVALID });
      return z.NEVER;
    }
  })
  .pipe(
    z.object(
      {
        clientId: z.number("Elige el cliente del pedido.").int("Elige el cliente del pedido.").positive("Elige el cliente del pedido."),
        locationId: z.number().int().positive().nullish().transform((v) => v ?? null),
        lines: z
          .array(productLineSchema, ORDER_INVALID)
          .min(1, "Agrega al menos un producto al pedido.")
          .max(MAX_LINES, `Un pedido no puede tener más de ${MAX_LINES} productos.`)
          .refine((all) => new Set(all.map((l) => l.referenceId)).size === all.length, DUPLICATE_PRODUCT),
      },
      ORDER_INVALID,
    ),
  );

export const orderSchema = z.object({
  deliveryDate: dateField("La fecha de entrega"),
  timeWindow: textField.refine((v) => v === null || v.length <= TIME_WINDOW_MAX, "La ventana horaria no puede pasar de 40 caracteres."),
  note: textField.refine((v) => v === null || v.length <= NOTE_MAX, "La nota no puede pasar de 500 caracteres."),
  order: orderField,
}).transform(({ order, ...rest }) => ({
  ...rest,
  // The order is stored per line: every line carries the order's client and finca.
  lines: order.lines.map((l) => ({ clientId: order.clientId, locationId: order.locationId, referenceId: l.referenceId, bags: l.bags })),
}));

export type OrderInput = z.infer<typeof orderSchema>;
export type OrderLineInput = OrderInput["lines"][number];

export const kgPerBagSchema = z
  .string()
  .default("")
  .transform((v) => parseDecimal(v))
  .refine((v): v is number => v !== null && isValidKgPerBag(v), "Los kg por bulto deben ser un número mayor que cero.")
  .transform((v) => v as number);

export const orderIdSchema = z.number().int().positive();

/** The day an order was delivered, an ISO day typed in the confirmation. */
export const deliveryDaySchema = dateField("La fecha de entrega");

/** The orders delivered (or restored) together. */
export const deliveryIdsSchema = z.array(orderIdSchema).min(1, "Elige al menos un pedido.").max(MAX_LINES);
