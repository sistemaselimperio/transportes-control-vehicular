/** Zod field for the supplies of an oil change; the form sends them as one JSON string. */
import { z } from "zod";
import type { OilItem } from "../domain/oil-items";

const QUANTITY = /^\d{1,4}([.,]\d{1,2})?$/;
const MAX_ITEMS = 30;

const rowSchema = z.object({
  quantity: z.union([z.string(), z.number()]).default("").transform((v) => String(v).trim()),
  detail: z.string().default("").transform((v) => v.trim()),
});

export const oilItemsField = z
  .string()
  .optional()
  .transform((raw, ctx): OilItem[] => {
    if (raw === undefined || raw.trim() === "") return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      ctx.addIssue({ code: "custom", message: "No se pudieron leer los insumos." });
      return z.NEVER;
    }
    const rows = z.array(rowSchema).max(MAX_ITEMS, "Hay demasiados insumos.").safeParse(parsed);
    if (!rows.success) {
      ctx.addIssue({ code: "custom", message: rows.error.issues[0]?.message ?? "Revisa los insumos." });
      return z.NEVER;
    }
    const items: OilItem[] = [];
    for (const row of rows.data) {
      if (row.quantity === "" && row.detail === "") continue;
      const quantity = QUANTITY.test(row.quantity) ? Number(row.quantity.replace(",", ".")) : 0;
      if (!(quantity > 0)) {
        ctx.addIssue({ code: "custom", message: "Cada insumo necesita una cantidad mayor a 0." });
        return z.NEVER;
      }
      if (row.detail === "") {
        ctx.addIssue({ code: "custom", message: "Describe cada insumo (por ejemplo, «filtro de aceite»)." });
        return z.NEVER;
      }
      items.push({ quantity, detail: row.detail });
    }
    return items;
  });
