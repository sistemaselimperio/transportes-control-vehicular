/**
 * PostgreSQL schema (hosted on Neon).
 * Only standard Postgres features: no provider-specific extensions or RLS.
 * Calendar dates use `date` in string mode ("YYYY-MM-DD") to match the domain.
 */
import {
  boolean,
  customType,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* ------------------------------ Enums ------------------------------ */

export const ownerGroupEnum = pgEnum("owner_group", [
  "IMPERIO",
  "PAEZ",
  "THIRD_PARTY",
]);
export const serviceTypeEnum = pgEnum("service_type", [
  "PARTICULAR",
  "PUBLICO",
]);
export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "ACTIVE",
  "IDLE",
  "IN_WORKSHOP",
  "SOLD",
]);
export const driverStatusEnum = pgEnum("driver_status", [
  "ACTIVE",
  "IN_WORKSHOP",
  "INACTIVE",
]);
export const oilModeEnum = pgEnum("oil_mode", ["date", "km", "both"]);
export const documentTypeEnum = pgEnum("document_type", [
  "SOAT",
  "TECNO",
  "POLICY",
]);
export const policyKindEnum = pgEnum("policy_kind", ["TR", "RC"]);
export const taxKindEnum = pgEnum("tax_kind", [
  "PAID_YEAR",
  "EXEMPT",
  "EXEMPT_LOW_DISPLACEMENT",
  "UNKNOWN",
]);

export const serviceKindEnum = pgEnum("service_kind", ["PREVENTIVE", "CORRECTIVE"]);

export const fileCategoryEnum = pgEnum("file_category", [
  "POLICY",
  "SOAT",
  "TECNO",
  "TAX",
  "LOGBOOK",
  "OWNERSHIP_CARD",
]);

/** Postgres bytea as a Node Buffer (drizzle has no built-in column for it). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/* ---------------------------- Fleet domain ---------------------------- */

export const owners = pgTable("owners", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  documentNumber: text("document_number"),
  group: ownerGroupEnum().notNull(),
});

export const vehicleClasses = pgTable("vehicle_classes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  /** Null means the class has no oil change (e.g. trailers). */
  oilIntervalKm: integer("oil_interval_km"),
  oilIntervalMonths: integer("oil_interval_months"),
  /** New vehicles of this class start with SOAT/TECNO flagged as not applicable. */
  documentsDefaultNotApplicable: boolean("documents_default_not_applicable")
    .notNull()
    .default(false),
});

export const vehicles = pgTable(
  "vehicles",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** Normalized by the domain `normalizePlate`. */
    plate: text().notNull(),
    classId: integer("class_id")
      .notNull()
      .references(() => vehicleClasses.id),
    brandLine: text("brand_line"),
    notes: text(),
    municipality: text(),
    serviceType: serviceTypeEnum("service_type").notNull().default("PARTICULAR"),
    status: vehicleStatusEnum().notNull().default("ACTIVE"),
    oilMode: oilModeEnum("oil_mode").notNull().default("both"),
    odometerWorking: boolean("odometer_working").notNull().default(true),
    currentKm: integer("current_km"),
    currentKmAt: date("current_km_at", { mode: "string" }),
    /** For trailers (Remolque): the tractor unit pulling it. */
    towingVehicleId: integer("towing_vehicle_id").references(
      (): AnyPgColumn => vehicles.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("vehicles_plate_uq").on(t.plate)],
);

export const ownerships = pgTable(
  "ownerships",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => owners.id),
    fromDate: date("from_date", { mode: "string" }).notNull(),
    toDate: date("to_date", { mode: "string" }),
  },
  (t) => [index("ownerships_vehicle_idx").on(t.vehicleId)],
);

export const drivers = pgTable("drivers", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  nationalId: text("national_id"),
  phone: text(),
  /** Company the driver works for (same groups as vehicle owners). */
  company: ownerGroupEnum(),
  status: driverStatusEnum().notNull().default("ACTIVE"),
});

export const driverAssignments = pgTable(
  "driver_assignments",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => drivers.id),
    fromDate: date("from_date", { mode: "string" }).notNull(),
    toDate: date("to_date", { mode: "string" }),
  },
  (t) => [index("driver_assignments_vehicle_idx").on(t.vehicleId)],
);

/** Renewal history: the latest row per (vehicle, type[, policy_kind]) is the current one. */
export const vehicleDocuments = pgTable(
  "vehicle_documents",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    type: documentTypeEnum().notNull(),
    /** Only for POLICY rows: TR (todo riesgo) or RC (responsabilidad civil). */
    policyKind: policyKindEnum("policy_kind"),
    expiresOn: date("expires_on", { mode: "string" }),
    notApplicable: boolean("not_applicable").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("vehicle_documents_vehicle_idx").on(t.vehicleId)],
);

export const vehicleTaxes = pgTable(
  "vehicle_taxes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    kind: taxKindEnum().notNull(),
    year: integer(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("vehicle_taxes_vehicle_idx").on(t.vehicleId)],
);

export const oilChanges = pgTable(
  "oil_changes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    km: integer(),
    /** Interval used for this change (defaults come from the class, editable). */
    intervalMonths: integer("interval_months"),
    intervalKm: integer("interval_km"),
    nextDate: date("next_date", { mode: "string" }),
    nextKm: integer("next_km"),
    /** Total cost in whole pesos (COP); null when unknown. */
    price: integer(),
    notes: text(),
  },
  (t) => [index("oil_changes_vehicle_idx").on(t.vehicleId)],
);

/** Supplies used in an oil change ("48" x "CUARTOS DELO 15W40"); read in insertion order. */
export const oilChangeItems = pgTable(
  "oil_change_items",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    oilChangeId: integer("oil_change_id")
      .notNull()
      .references(() => oilChanges.id, { onDelete: "cascade" }),
    quantity: numeric({ precision: 8, scale: 2, mode: "number" }).notNull(),
    detail: text().notNull(),
  },
  (t) => [index("oil_change_items_oil_change_idx").on(t.oilChangeId)],
);

/** Logbook: workshop services and repairs. */
export const vehicleServices = pgTable(
  "vehicle_services",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    kind: serviceKindEnum().notNull(),
    description: text().notNull(),
    /** Free text; the forms suggest the providers already used. */
    provider: text(),
    km: integer(),
    /** Whole pesos (COP); null when unknown. */
    price: integer(),
    notes: text(),
  },
  (t) => [index("vehicle_services_vehicle_date_idx").on(t.vehicleId, t.date)],
);

/** Logbook: tire changes. */
export const tireChanges = pgTable(
  "tire_changes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    quantity: integer().notNull(),
    reference: text().notNull(),
    provider: text(),
    price: integer(),
    notes: text(),
  },
  (t) => [index("tire_changes_vehicle_date_idx").on(t.vehicleId, t.date)],
);

/** Logbook: fuel fills. `provider` is the station. */
export const fuelFills = pgTable(
  "fuel_fills",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    gallons: numeric({ precision: 8, scale: 2, mode: "number" }).notNull(),
    /** Amount paid, whole pesos (COP). */
    amount: integer().notNull(),
    provider: text(),
  },
  (t) => [index("fuel_fills_vehicle_date_idx").on(t.vehicleId, t.date)],
);

export const sales = pgTable("sales", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  vehicleId: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  /** Null when the sale date is unknown (e.g. imported from the old Excel). */
  date: date({ mode: "string" }),
  buyer: text(),
  price: integer(),
  notes: text(),
});

/** Scanned papers (PDF / images) of a vehicle. List queries must never select `data`. */
export const vehicleFiles = pgTable(
  "vehicle_files",
  {
    id: uuid().primaryKey().defaultRandom(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    category: fileCategoryEnum().notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    data: bytea().notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("vehicle_files_vehicle_category_idx").on(t.vehicleId, t.category)],
);

/* ------------------- Better Auth (username plugin) ------------------- */

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  username: text().unique(),
  displayUsername: text("display_username"),
});

export const session = pgTable("session", {
  id: text().primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text().notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text().primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text(),
  password: text(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verification = pgTable("verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
