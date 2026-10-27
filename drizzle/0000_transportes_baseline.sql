CREATE SCHEMA IF NOT EXISTS "transportes";
--> statement-breakpoint
CREATE TYPE "transportes"."document_type" AS ENUM('SOAT', 'TECNO', 'POLICY');--> statement-breakpoint
CREATE TYPE "transportes"."driver_status" AS ENUM('ACTIVE', 'IN_WORKSHOP', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "transportes"."file_category" AS ENUM('POLICY', 'SOAT', 'TECNO', 'TAX', 'LOGBOOK', 'OWNERSHIP_CARD');--> statement-breakpoint
CREATE TYPE "transportes"."oil_mode" AS ENUM('date', 'km', 'both');--> statement-breakpoint
CREATE TYPE "transportes"."owner_group" AS ENUM('IMPERIO', 'PAEZ', 'THIRD_PARTY');--> statement-breakpoint
CREATE TYPE "transportes"."policy_kind" AS ENUM('TR', 'RC');--> statement-breakpoint
CREATE TYPE "transportes"."service_kind" AS ENUM('PREVENTIVE', 'CORRECTIVE');--> statement-breakpoint
CREATE TYPE "transportes"."service_type" AS ENUM('PARTICULAR', 'PUBLICO');--> statement-breakpoint
CREATE TYPE "transportes"."tax_kind" AS ENUM('PAID_YEAR', 'EXEMPT', 'EXEMPT_LOW_DISPLACEMENT', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "transportes"."vehicle_status" AS ENUM('ACTIVE', 'IDLE', 'IN_WORKSHOP', 'SOLD');--> statement-breakpoint
CREATE TABLE "transportes"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportes"."driver_assignments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."driver_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date
);
--> statement-breakpoint
CREATE TABLE "transportes"."drivers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."drivers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"national_id" text,
	"phone" text,
	"company" "transportes"."owner_group",
	"status" "transportes"."driver_status" DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportes"."fuel_fills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."fuel_fills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"date" date NOT NULL,
	"gallons" numeric(8, 2) NOT NULL,
	"amount" integer NOT NULL,
	"provider" text
);
--> statement-breakpoint
CREATE TABLE "transportes"."oil_change_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."oil_change_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"oil_change_id" integer NOT NULL,
	"quantity" numeric(8, 2) NOT NULL,
	"detail" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportes"."oil_changes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."oil_changes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"date" date NOT NULL,
	"km" integer,
	"interval_months" integer,
	"interval_km" integer,
	"next_date" date,
	"next_km" integer,
	"price" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "transportes"."owners" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."owners_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"document_number" text,
	"group" "transportes"."owner_group" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportes"."ownerships" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."ownerships_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"owner_id" integer NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date
);
--> statement-breakpoint
CREATE TABLE "transportes"."sales" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."sales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"date" date,
	"buyer" text,
	"price" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "transportes"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "transportes"."tire_changes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."tire_changes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"date" date NOT NULL,
	"quantity" integer NOT NULL,
	"reference" text NOT NULL,
	"provider" text,
	"price" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "transportes"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"username" text,
	"display_username" text,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "transportes"."vehicle_classes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."vehicle_classes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"oil_interval_km" integer,
	"oil_interval_months" integer,
	"documents_default_not_applicable" boolean DEFAULT false NOT NULL,
	CONSTRAINT "vehicle_classes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "transportes"."vehicle_documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."vehicle_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"type" "transportes"."document_type" NOT NULL,
	"policy_kind" "transportes"."policy_kind",
	"expires_on" date,
	"not_applicable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportes"."vehicle_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" integer NOT NULL,
	"category" "transportes"."file_category" NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportes"."vehicle_services" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."vehicle_services_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"date" date NOT NULL,
	"kind" "transportes"."service_kind" NOT NULL,
	"description" text NOT NULL,
	"provider" text,
	"km" integer,
	"price" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "transportes"."vehicle_taxes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."vehicle_taxes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"kind" "transportes"."tax_kind" NOT NULL,
	"year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportes"."vehicles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."vehicles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"plate" text NOT NULL,
	"class_id" integer NOT NULL,
	"brand_line" text,
	"notes" text,
	"municipality" text,
	"service_type" "transportes"."service_type" DEFAULT 'PARTICULAR' NOT NULL,
	"status" "transportes"."vehicle_status" DEFAULT 'ACTIVE' NOT NULL,
	"oil_mode" "transportes"."oil_mode" DEFAULT 'both' NOT NULL,
	"odometer_working" boolean DEFAULT true NOT NULL,
	"current_km" integer,
	"current_km_at" date,
	"towing_vehicle_id" integer,
	"registration_date" date,
	"model_year" integer,
	"engine_number" text,
	"chassis_number" text,
	"serial_number" text,
	"body_type" text,
	"fuel_type" text,
	"capacity" text,
	"engine_displacement" integer,
	"gross_weight_kg" integer,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportes"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transportes"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "transportes"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."driver_assignments" ADD CONSTRAINT "driver_assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."driver_assignments" ADD CONSTRAINT "driver_assignments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "transportes"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."fuel_fills" ADD CONSTRAINT "fuel_fills_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."oil_change_items" ADD CONSTRAINT "oil_change_items_oil_change_id_oil_changes_id_fk" FOREIGN KEY ("oil_change_id") REFERENCES "transportes"."oil_changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."oil_changes" ADD CONSTRAINT "oil_changes_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."ownerships" ADD CONSTRAINT "ownerships_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."ownerships" ADD CONSTRAINT "ownerships_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "transportes"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."sales" ADD CONSTRAINT "sales_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "transportes"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."tire_changes" ADD CONSTRAINT "tire_changes_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."vehicle_files" ADD CONSTRAINT "vehicle_files_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."vehicle_services" ADD CONSTRAINT "vehicle_services_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."vehicle_taxes" ADD CONSTRAINT "vehicle_taxes_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."vehicles" ADD CONSTRAINT "vehicles_class_id_vehicle_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "transportes"."vehicle_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."vehicles" ADD CONSTRAINT "vehicles_towing_vehicle_id_vehicles_id_fk" FOREIGN KEY ("towing_vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "driver_assignments_vehicle_idx" ON "transportes"."driver_assignments" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "fuel_fills_vehicle_date_idx" ON "transportes"."fuel_fills" USING btree ("vehicle_id","date");--> statement-breakpoint
CREATE INDEX "oil_change_items_oil_change_idx" ON "transportes"."oil_change_items" USING btree ("oil_change_id");--> statement-breakpoint
CREATE INDEX "oil_changes_vehicle_idx" ON "transportes"."oil_changes" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "ownerships_vehicle_idx" ON "transportes"."ownerships" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "tire_changes_vehicle_date_idx" ON "transportes"."tire_changes" USING btree ("vehicle_id","date");--> statement-breakpoint
CREATE INDEX "vehicle_documents_vehicle_idx" ON "transportes"."vehicle_documents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_files_vehicle_category_idx" ON "transportes"."vehicle_files" USING btree ("vehicle_id","category");--> statement-breakpoint
CREATE INDEX "vehicle_services_vehicle_date_idx" ON "transportes"."vehicle_services" USING btree ("vehicle_id","date");--> statement-breakpoint
CREATE INDEX "vehicle_taxes_vehicle_idx" ON "transportes"."vehicle_taxes" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_plate_uq" ON "transportes"."vehicles" USING btree ("plate");