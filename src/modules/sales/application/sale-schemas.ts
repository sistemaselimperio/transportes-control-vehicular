/** Zod schema that parses the raw form values (strings) of the sale edit form. */
import { z } from "zod";
import { sellSchema } from "@/modules/vehicles/application/vehicle-action-schemas";

export const saleEditSchema = z.object({
  // Same rules as when the sale is registered, except that an unknown date stays allowed.
  date: z
    .string()
    .default("")
    .transform((v, ctx) => {
      const value = v.trim();
      if (value === "") return null;
      const parsed = sellSchema.shape.date.safeParse(value);
      if (parsed.success) return parsed.data;
      ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Fecha no válida." });
      return z.NEVER;
    }),
  buyer: sellSchema.shape.buyer,
  price: sellSchema.shape.price,
  notes: sellSchema.shape.notes,
});

export type SaleEditInput = z.infer<typeof saleEditSchema>;

export const saleIdSchema = z.number().int().positive();
