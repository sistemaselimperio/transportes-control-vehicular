/**
 * PostgreSQL schema, isolated in the `transportes` schema of the shared Supabase
 * project (other apps own `public`).
 * Only standard Postgres features: no provider-specific extensions or RLS.
 * Calendar dates use `date` in string mode ("YYYY-MM-DD") to match the domain.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const transportes = pgSchema("transportes");
/** The commercial area (clients, deliveries, loads) lives in its own schema of the shared project. */
export const comercial = pgSchema("comercial");

/* ------------------------------ Enums ------------------------------ */

export const ownerGroupEnum = transportes.enum("owner_group", [
  "IMPERIO",
  "PAEZ",
  "THIRD_PARTY",
]);
export const serviceTypeEnum = transportes.enum("service_type", [
  "PARTICULAR",
  "PUBLICO",
]);
export const vehicleStatusEnum = transportes.enum("vehicle_status", [
  "ACTIVE",
  "IDLE",
  "IN_WORKSHOP",
  "SOLD",
]);
export const driverStatusEnum = transportes.enum("driver_status", [
  "ACTIVE",
  "IN_WORKSHOP",
  "INACTIVE",
]);
export const oilModeEnum = transportes.enum("oil_mode", ["date", "km", "both"]);
export const documentTypeEnum = transportes.enum("document_type", [
  "SOAT",
  "TECNO",
  "POLICY",
]);
export const exitDecisionEnum = transportes.enum("exit_decision", ["APTO", "NO_APTO"]);
export const policyKindEnum = transportes.enum("policy_kind", ["TR", "RC"]);
export const taxKindEnum = transportes.enum("tax_kind", [
  "PAID_YEAR",
  "EXEMPT",
  "EXEMPT_LOW_DISPLACEMENT",
  "UNKNOWN",
]);

export const serviceKindEnum = transportes.enum("service_kind", ["PREVENTIVE", "CORRECTIVE"]);
export const trailerTireEventTypeEnum = transportes.enum("trailer_tire_event_type", [
  "CHANGE",
  "REPAIR",
  "ROTATION",
  "INSPECTION",
]);
export const tireConditionEnum = transportes.enum("tire_condition", ["GOOD", "FAIR", "BAD"]);

export const fileCategoryEnum = transportes.enum("file_category", [
  "POLICY",
  "SOAT",
  "TECNO",
  "TAX",
  "LOGBOOK",
  "OWNERSHIP_CARD",
  "OTHER",
]);
export const tripStatusEnum = transportes.enum("trip_status", ["programado", "entregado"]);
export const tripAreaEnum = transportes.enum("trip_area", [
  "Traslados",
  "Cemento",
  "Ganadería",
  "Ruta Ricaurte",
  "Abono",
  "Concentrado",
  "Combustible",
  "Trasolicar",
]);

/* ---------------------------- Fleet domain ---------------------------- */

export const owners = transportes.table("owners", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  documentNumber: text("document_number"),
  group: ownerGroupEnum().notNull(),
});

export const vehicleClasses = transportes.table("vehicle_classes", {
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

export const vehicles = transportes.table(
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
    /** "Datos generales" of the registration sheet; all optional. */
    registrationDate: date("registration_date", { mode: "string" }),
    modelYear: integer("model_year"),
    engineNumber: text("engine_number"),
    chassisNumber: text("chassis_number"),
    serialNumber: text("serial_number"),
    bodyType: text("body_type"),
    fuelType: text("fuel_type"),
    /** Total cargo capacity in tons. */
    capacity: numeric("capacity", { precision: 8, scale: 2, mode: "number" }),
    engineDisplacement: integer("engine_displacement"),
    grossWeightKg: integer("gross_weight_kg"),
    color: text(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("vehicles_plate_uq").on(t.plate)],
);

export const ownerships = transportes.table(
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

export const drivers = transportes.table("drivers", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  nationalId: text("national_id"),
  phone: text(),
  /** Company the driver works for (same groups as vehicle owners). */
  company: ownerGroupEnum(),
  status: driverStatusEnum().notNull().default("ACTIVE"),
});

export const driverAssignments = transportes.table(
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
export const vehicleDocuments = transportes.table(
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

export const vehicleTaxes = transportes.table(
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

export const oilChanges = transportes.table(
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
export const oilChangeItems = transportes.table(
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
export const vehicleServices = transportes.table(
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
export const tireChanges = transportes.table(
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

/**
 * Events on the tire positions of a trailer (12 fixed positions, see the `trailer-tires` module).
 * The position, not the physical tire, is the identity. A rotation is one row: `position` and
 * `counterpart_position` swap, and it shows in the history of both.
 */
export const trailerTireEvents = transportes.table(
  "trailer_tire_events",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    /** Position code `E{1..3}-{I|D}-{INT|EXT}`; validated by the domain. */
    position: text().notNull(),
    type: trailerTireEventTypeEnum().notNull(),
    date: date({ mode: "string" }).notNull(),
    /** Change: the tire reference. */
    reference: text(),
    provider: text(),
    /** Whole pesos (COP); null when unknown. */
    price: integer(),
    /** A repair's description, or any free note. */
    notes: text(),
    /** Rotation: the other position of the swap. */
    counterpartPosition: text("counterpart_position"),
    /** Inspection: tread depth in millimetres. */
    treadDepthMm: numeric("tread_depth_mm", { precision: 4, scale: 1, mode: "number" }),
    /** Inspection: pressure in psi. */
    pressurePsi: numeric("pressure_psi", { precision: 5, scale: 1, mode: "number" }),
    condition: tireConditionEnum(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trailer_tire_events_vehicle_position_date_idx").on(t.vehicleId, t.position, t.date),
    check(
      "trailer_tire_events_rotation_differs_check",
      sql`counterpart_position is null or counterpart_position <> position`,
    ),
  ],
);

/** Logbook: fuel fills. `provider` is the station. */
export const fuelFills = transportes.table(
  "fuel_fills",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    /** Fuel gallons; null on a urea-only fill. */
    gallons: numeric({ precision: 8, scale: 2, mode: "number" }),
    /** Urea (DEF) gallons; null when the fill has none. */
    urea: numeric({ precision: 8, scale: 2, mode: "number" }),
    /** Amount paid, whole pesos (COP); null when unknown. */
    amount: integer(),
    provider: text(),
  },
  (t) => [
    index("fuel_fills_vehicle_date_idx").on(t.vehicleId, t.date),
    // Unqualified column names on purpose: the generated DDL stays plain.
    check("fuel_fills_has_product_check", sql`coalesce(gallons, 0) > 0 or coalesce(urea, 0) > 0`),
  ],
);

export const sales = transportes.table("sales", {
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

/**
 * Scanned papers (PDF / images) of a vehicle. The bytes live in Supabase Storage at `storage_path`.
 */
export const vehicleFiles = transportes.table(
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
    storagePath: text("storage_path").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("vehicle_files_vehicle_category_idx").on(t.vehicleId, t.category)],
);

/**
 * Daily pre-operational inspections (form FO-PESV-016), submitted from the public form. The header
 * is free text on purpose (the fleet data is incomplete); the ids below are soft links, filled in when
 * the typed plate / national id matches a registered record and null otherwise.
 */
export const preoperationalInspections = transportes.table(
  "preoperational_inspections",
  {
    id: uuid().primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Colombia calendar date and local time as typed on the form. */
    inspectionDate: date("inspection_date", { mode: "string" }).notNull(),
    inspectionTime: text("inspection_time").notNull(),
    plate: text().notNull(),
    trailerPlate: text("trailer_plate"),
    vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    trailerVehicleId: integer("trailer_vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    driverId: integer("driver_id").references(() => drivers.id, { onDelete: "set null" }),
    driverName: text("driver_name").notNull(),
    driverNationalId: text("driver_national_id").notNull(),
    odometer: text().notNull(),
    route: text().notNull(),
    /**
     * "Parte diario" tab of the public form. Nullable because rows saved before the tab existed have
     * none; new submissions must carry all four (the domain validation requires them).
     */
    restHours: text("rest_hours"),
    location: text(),
    fuel: text(),
    pendingMaintenance: text("pending_maintenance"),
    /** Legacy: superseded by `notApplicableSections`; still written (true when "mule" is skipped) for compatibility. */
    muleNotApplicable: boolean("mule_not_applicable").notNull().default(false),
    /** Ids of the checklist sections marked "no aplica": their items were not asked. */
    notApplicableSections: jsonb("not_applicable_sections").$type<string[]>().notNull().default([]),
    /** Checklist item id to `{ status: "BIEN" | "MAL", note? }`; ids live in the domain checklist. */
    answers: jsonb().$type<Record<string, { status: "BIEN" | "MAL"; note?: string }>>().notNull(),
    /** Computed server-side: some critical point (★) is MAL. */
    hasCriticalFailure: boolean("has_critical_failure").notNull().default(false),
    /** PNG data URL of the drawn signature. */
    signature: text().notNull(),
    /** Decision of the maintenance chief; null while pending. Overwritten when she changes it. */
    exitDecision: exitDecisionEnum("exit_decision"),
    /** HH:MM, Colombia local time; only set with APTO. */
    exitAuthorizedTime: text("exit_authorized_time"),
    exitDecidedAt: timestamp("exit_decided_at", { withTimezone: true }),
    exitDecidedBy: text("exit_decided_by").references(() => user.id, { onDelete: "set null" }),
    /** Novelty closure, only for inspections with some item MAL. */
    closureDate: date("closure_date", { mode: "string" }),
    closureWorkOrder: text("closure_work_order"),
    closureAction: text("closure_action"),
    closureResponsible: text("closure_responsible"),
    closureRecordedAt: timestamp("closure_recorded_at", { withTimezone: true }),
    closureRecordedBy: text("closure_recorded_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    index("preoperational_inspections_exit_decision_idx").on(t.exitDecision),
    index("preoperational_inspections_date_idx").on(t.inspectionDate, t.createdAt),
    index("preoperational_inspections_plate_idx").on(t.plate),
    index("preoperational_inspections_vehicle_idx").on(t.vehicleId),
    index("preoperational_inspections_trailer_vehicle_idx").on(t.trailerVehicleId),
    index("preoperational_inspections_driver_idx").on(t.driverId),
  ],
);

/**
 * Trips of the fleet. `plate` is a snapshot of the vehicle's plate; `vehicleId` is a soft link
 * that goes null when the vehicle is deleted, so trips never depend on the fleet.
 */
export const trips = transportes.table(
  "trips",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** Start instant; the date and hour are typed in Colombia local time. */
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    /** Municipality label; null on trips saved before the origin existed. */
    origin: text(),
    destination: text().notNull(),
    plate: text().notNull(),
    vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    area: tripAreaEnum().notNull(),
    status: tripStatusEnum().notNull().default("programado"),
    /** Free-text remark about the trip. */
    notes: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trips_start_at_idx").on(t.startAt),
    index("trips_vehicle_idx").on(t.vehicleId),
    index("trips_status_idx").on(t.status),
  ],
);

/* ------------------------ Comercial (commercial area) ------------------------ */

export const deliveryShiftEnum = comercial.enum("delivery_shift", ["1er viaje", "2do viaje", "3er viaje"]);
export const deliveryPriorityEnum = comercial.enum("delivery_priority", ["urgente", "normal"]);
export const deliveryStatusEnum = comercial.enum("delivery_status", ["pendiente", "entregado"]);
export const loadSupplierEnum = comercial.enum("load_supplier", ["Finca", "Italcol", "Contegral"]);
export const orderStatusEnum = comercial.enum("order_status", ["pendiente", "cargado", "anulado"]);

/**
 * Customers of the commercial area. Names keep the casing typed; `nameKey` (see `searchKey`) makes
 * them unique regardless of case, accents and spaces. Where a client receives goods lives in
 * `clientLocations` (fincas).
 */
export const clients = comercial.table(
  "clients",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    /** `searchKey(name)`: the unique, case/accent/space-insensitive identity of the name. */
    nameKey: text("name_key").notNull(),
    /** Digits only (see `normalizeNit`); unique when present. */
    nit: text(),
    phone: text(),
    notes: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("clients_nit_uq").on(t.nit).where(sql`nit is not null`),
    uniqueIndex("clients_name_key_uq").on(t.nameKey),
  ],
);

/** A place of a client where goods are delivered (a "finca"). Its name is unique per client. */
export const clientLocations = comercial.table(
  "client_locations",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text().notNull(),
    /** `searchKey(name)`; unique together with the client. */
    nameKey: text("name_key").notNull(),
    address: text(),
    /** The link as pasted from Google Maps. */
    mapsUrl: text("maps_url"),
    /** Parsed from `mapsUrl` when the link carries coordinates; null for short links. */
    latitude: numeric({ precision: 10, scale: 7, mode: "number" }),
    longitude: numeric({ precision: 10, scale: 7, mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("client_locations_client_name_uq").on(t.clientId, t.nameKey)],
);

/**
 * A delivery of bags to a client. `weightKg` is typed by hand and never derived from `quantity`;
 * tons are derived on read (kg / 1000), never stored. `plate` is a snapshot and `vehicleId` a soft
 * link that goes null when the vehicle is deleted (same as trips).
 */
export const deliveries = comercial.table(
  "deliveries",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** Colombia calendar day. */
    date: date({ mode: "string" }).notNull(),
    shift: deliveryShiftEnum().notNull(),
    priority: deliveryPriorityEnum().notNull().default("normal"),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    /** Optional finca of the client; goes null when the finca is deleted. */
    locationId: integer("location_id").references(() => clientLocations.id, { onDelete: "set null" }),
    /** Municipality label ("Simijaca (Cundinamarca)") of Boyacá, Cundinamarca or Santander, as trips store theirs. */
    destination: text().notNull(),
    /** Bags (bultos). */
    quantity: integer().notNull(),
    weightKg: numeric("weight_kg", { precision: 12, scale: 2, mode: "number" }).notNull(),
    status: deliveryStatusEnum().notNull().default("pendiente"),
    plate: text(),
    vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    notes: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deliveries_date_idx").on(t.date),
    index("deliveries_client_idx").on(t.clientId),
    index("deliveries_location_idx").on(t.locationId),
    index("deliveries_status_idx").on(t.status),
    check("deliveries_quantity_positive", sql`${t.quantity} > 0`),
    check("deliveries_weight_positive", sql`${t.weightKg} > 0`),
  ],
);

/**
 * Supplier loads received at the yard: the header of a load (one supplier, one truck). Its products,
 * with tons, cost and SIESA number each, are the `load_lines`. Not linked to clients. `plate` is a
 * fleet snapshot, like trips.
 */
export const loads = comercial.table(
  "loads",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    date: date({ mode: "string" }).notNull(),
    supplier: loadSupplierEnum().notNull(),
    plate: text().notNull(),
    vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    notes: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("loads_date_idx").on(t.date), index("loads_supplier_idx").on(t.supplier)],
);

/**
 * A product of a load, with its own tons, cost, SIESA number (unique across every line) and the
 * supplier's order number. Every line takes its product from exactly one order (`order_id`): an order is
 * loaded in parts, one load per supplier, and a product may be split across several lines. The tons of
 * the lines of an (order, product) must add up to bags x kg per bag; the application enforces it.
 * `reference_id` is null only for lines migrated from the single-product loads.
 */
export const loadLines = comercial.table(
  "load_lines",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    loadId: integer("load_id")
      .notNull()
      .references(() => loads.id, { onDelete: "cascade" }),
    /** The order the product is taken from. Orders are annulled, never deleted. */
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    referenceId: integer("reference_id").references(() => orderReferences.id, { onDelete: "restrict" }),
    tons: numeric({ precision: 10, scale: 3, mode: "number" }).notNull(),
    /** Whole pesos (COP). */
    cost: numeric({ precision: 14, scale: 2, mode: "number" }).notNull(),
    siesaNumber: text("siesa_number").notNull().unique(),
    /** The supplier's order number. */
    orderNumber: text("order_number").notNull(),
    /** Order of the line inside its load. */
    position: integer().notNull().default(0),
  },
  (t) => [
    index("load_lines_load_idx").on(t.loadId),
    index("load_lines_order_idx").on(t.orderId),
    check("load_lines_tons_positive", sql`${t.tons} > 0`),
    check("load_lines_cost_non_negative", sql`${t.cost} >= 0`),
  ],
);

/** Key/value settings of the commercial area (today only the kilograms per bag, `kg_per_bag`). */
export const comercialSettings = comercial.table("settings", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Catalog of the products of the concentrate orders and loads. A catalog product has a supplier and the
 * supplier's own code, unique together (names repeat, and so do codes across suppliers). Rows without
 * `code`/`supplier` are legacy products typed inline before the catalog: they keep showing on the old
 * orders and loads that point to them but are never offered again.
 */
export const orderReferences = comercial.table(
  "order_references",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    code: text(),
    supplier: loadSupplierEnum(),
    /**
     * Deprecated: identity of the products typed inline before the catalog. Kept nullable and unique only
     * so the previous deployment keeps working until this one is live; drop it in a later migration.
     */
    nameKey: text("name_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("order_references_supplier_code_uq").on(t.supplier, t.code),
    uniqueIndex("order_references_name_key_uq").on(t.nameKey),
  ],
);

/**
 * A concentrate order ("pedido"): the bags several clients asked for, to be delivered on a day. Only
 * bags are stored; kg and tons are derived with the current kg per bag. It may hold products of several
 * suppliers and is loaded in parts, one load per supplier (the `load_lines` point back at it). Whether it
 * is loaded, partially loaded or pending is derived from those loads: the persisted `status` only
 * distinguishes an annulled order (`anulado`) from the rest. Only an order no load has touched can be
 * edited or annulled.
 */
export const orders = comercial.table(
  "orders",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    deliveryDate: date("delivery_date", { mode: "string" }).notNull(),
    /** Free text, e.g. "7–11 a.m.". */
    timeWindow: text("time_window"),
    note: text(),
    status: orderStatusEnum().notNull().default("pendiente"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_delivery_date_idx").on(t.deliveryDate),
    index("orders_status_idx").on(t.status),
  ],
);

export const orderLines = comercial.table(
  "order_lines",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    /** Optional finca of the client; goes null when the finca is deleted. */
    locationId: integer("location_id").references(() => clientLocations.id, { onDelete: "set null" }),
    referenceId: integer("reference_id")
      .notNull()
      .references(() => orderReferences.id, { onDelete: "restrict" }),
    bags: integer().notNull(),
    /** Order of the line inside its order. */
    position: integer().notNull().default(0),
  },
  (t) => [
    index("order_lines_order_idx").on(t.orderId),
    index("order_lines_client_idx").on(t.clientId),
    check("order_lines_bags_positive", sql`${t.bags} > 0`),
  ],
);

/* ------------------- Better Auth (username plugin) ------------------- */

export const user = transportes.table("user", {
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
  /** Access per section depends on the role (see `src/lib/permissions.ts`). */
  role: text().notNull().default("staff"),
  /** "yellow" (brand default) or "sky": the palette the app shell renders in (see `src/lib/theme.ts`). */
  theme: text().notNull().default("yellow"),
  /** Only users with this flag see and use the petty-cash ledgers (see `src/modules/petty-cash`). */
  hasPettyCash: boolean("has_petty_cash").notNull().default(false),
});

export const session = transportes.table("session", {
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

export const account = transportes.table("account", {
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

export const verification = transportes.table("verification", {
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

/* ------------------------- Petty cash (caja menor) ------------------------- */

export const pettyCashResponsibilityEnum = transportes.enum("petty_cash_responsibility", [
  "none_active",
  "electronic_invoicer",
]);

/**
 * The opening balance of a user's very first ledger, typed by hand. Every later opening balance
 * is derived on read from the previous closing balance, so nothing else is stored.
 */
export const pettyCashAccounts = transportes.table("petty_cash_accounts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  initialBalance: integer("initial_balance").notNull().default(0),
});

/** One cut per cash injection ("compense"). Amounts are whole pesos. */
export const pettyCashLedgers = transportes.table(
  "petty_cash_ledgers",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The user's own consecutive number ("Planilla 12"): permanent, never reused or renumbered. */
    number: integer().notNull(),
    date: date({ mode: "string" }).notNull(),
    compenseAmount: integer("compense_amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("petty_cash_ledgers_user_date_idx").on(t.userId, t.date),
    uniqueIndex("petty_cash_ledgers_user_number_uq").on(t.userId, t.number),
  ],
);

/**
 * An expense of a ledger. `nit` and `supplierName` identify the supplier that issued the invoice;
 * `company` is the party the invoice is billed to (an owner when `ownerId` links one: a soft link
 * that goes null if the owner is deleted, `company` keeps the text). `vehicleLabel` is the plate of
 * the fleet vehicle when `vehicleId` links one (also a soft link), else free text.
 * Expenses read by the AI import start with `needsReview` and may lack the NIT, the vehicle or the
 * value (a null value counts as zero in the totals) until someone completes them.
 * The attachment bytes live in Supabase Storage at `attachmentPath`.
 */
export const pettyCashExpenses = transportes.table(
  "petty_cash_expenses",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    ledgerId: integer("ledger_id")
      .notNull()
      .references(() => pettyCashLedgers.id, { onDelete: "cascade" }),
    detail: text().notNull(),
    invoiceNumber: text("invoice_number"),
    efk: text(),
    nit: text(),
    supplierName: text("supplier_name"),
    company: text(),
    ownerId: integer("owner_id").references(() => owners.id, { onDelete: "set null" }),
    responsibilityType: pettyCashResponsibilityEnum("responsibility_type"),
    vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    vehicleLabel: text("vehicle_label"),
    value: integer(),
    needsReview: boolean("needs_review").notNull().default(false),
    /** Another expense of the same user has the same supplier NIT and invoice number. */
    possibleDuplicate: boolean("possible_duplicate").notNull().default(false),
    attachmentPath: text("attachment_path"),
    attachmentName: text("attachment_name"),
    attachmentMime: text("attachment_mime"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("petty_cash_expenses_ledger_idx").on(t.ledgerId),
    check("petty_cash_expenses_value_positive", sql`${t.value} > 0`),
  ],
);

/** Issuing suppliers by NIT (digits only), shared by every petty-cash user, to complete new expenses. */
export const pettyCashSuppliers = transportes.table("petty_cash_suppliers", {
  nit: text().primaryKey(),
  supplierName: text("supplier_name"),
  responsibilityType: pettyCashResponsibilityEnum("responsibility_type"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
