/** Zod schemas that parse the raw form values (strings) of each vehicle action. */
import { z } from "zod";
import { oilItemsField } from "@/modules/maintenance/application/oil-items-schema";

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Required ISO calendar date from an `<input type="date">`. */
export const dateField = (label: string) =>
  z
    .string()
    .default("")
    .refine(
      (v) => VALID_DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)),
      `${label}: ingresa una fecha válida.`,
    );

/** Trimmed text where blank means "not provided". */
export const textField = z
  .string()
  .default("")
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? null : v));

/** Optional non-negative integer; tolerates "359.174"-style thousands separators. */
export const intField = (label: string, max = 2_000_000_000) =>
  z
    .string()
    .default("")
    .transform((v) => v.replace(/[.,\s]/g, ""))
    .refine((v) => v === "" || /^\d{1,10}$/.test(v), `${label} debe ser un número entero.`)
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || v <= max, `${label} es demasiado grande.`);

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

export const renewDocumentSchema = z.object({
  type: z.enum(["SOAT", "TECNO", "POLICY"], "Elige el documento."),
  policyKind: textField.pipe(z.enum(["TR", "RC"]).nullable()),
  expiresOn: z
    .string()
    .default("")
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || (VALID_DATE.test(v) && !Number.isNaN(Date.parse(v))), "La fecha de vencimiento no es válida."),
  notApplicable: checkbox,
});

export const updateTaxSchema = z.object({
  kind: z.enum(["PAID_YEAR", "EXEMPT", "EXEMPT_LOW_DISPLACEMENT"], "Elige el estado del impuesto."),
  year: intField("El año", 2100),
});

export const oilChangeSchema = z.object({
  date: dateField("Fecha"),
  km: intField("El kilometraje", 999_999_999),
  intervalMonths: intField("Los meses de intervalo", 120),
  intervalKm: intField("Los km de intervalo", 999_999),
  price: intField("El precio"),
  notes: textField,
  items: oilItemsField,
});

export const updateKmSchema = z.object({
  km: intField("El kilometraje", 999_999_999),
  odometerBroken: checkbox,
});

export const statusSchema = z.object({
  status: z.enum(["ACTIVE", "IDLE", "IN_WORKSHOP"], "Elige el estado."),
});

export const assignDriverSchema = z
  .object({
    mode: z.enum(["existing", "new"]),
    driverId: intField("El conductor"),
    name: textField,
    nationalId: textField,
    phone: textField,
    date: dateField("Fecha"),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "existing" && v.driverId == null) {
      ctx.addIssue({ code: "custom", message: "Elige un conductor." });
    }
    if (v.mode === "new" && v.name == null) {
      ctx.addIssue({ code: "custom", message: "Ingresa el nombre del conductor." });
    }
  });

export const transferOwnerSchema = z
  .object({
    /** An owner id, "IMPERIO" or "NEW". */
    owner: z.string().default(""),
    newName: textField,
    newDocument: textField,
    date: dateField("Fecha"),
  })
  .superRefine((v, ctx) => {
    if (v.owner === "") ctx.addIssue({ code: "custom", message: "Elige el propietario." });
    if (v.owner === "NEW" && v.newName == null) {
      ctx.addIssue({ code: "custom", message: "Ingresa el nombre del nuevo propietario." });
    }
    if (v.owner !== "" && v.owner !== "NEW" && v.owner !== "IMPERIO" && !/^\d+$/.test(v.owner)) {
      ctx.addIssue({ code: "custom", message: "Propietario no válido." });
    }
  });

export const sellSchema = z.object({
  date: dateField("Fecha de venta"),
  buyer: textField,
  price: intField("El precio"),
  notes: textField,
});

export const plateSchema = z.string().min(1).max(20);

export const oilChangeIdSchema = z.number().int().positive();
