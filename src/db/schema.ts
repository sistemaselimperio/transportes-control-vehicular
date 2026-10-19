/**
 * PostgreSQL schema (hosted on Neon).
 * Only standard Postgres features: no provider-specific extensions or RLS.
 * Calendar dates use `date` in string mode ("YYYY-MM-DD") to match the domain.
 */
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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
    notes: text(),
  },
  (t) => [index("oil_changes_vehicle_idx").on(t.vehicleId)],
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
