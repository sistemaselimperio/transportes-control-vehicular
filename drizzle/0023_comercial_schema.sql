CREATE SCHEMA "comercial";
--> statement-breakpoint
CREATE TYPE "comercial"."delivery_priority" AS ENUM('urgente', 'normal');--> statement-breakpoint
CREATE TYPE "comercial"."delivery_shift" AS ENUM('1er viaje', '2do viaje', '3er viaje');--> statement-breakpoint
CREATE TYPE "comercial"."delivery_status" AS ENUM('pendiente', 'entregado');--> statement-breakpoint
CREATE TYPE "comercial"."load_supplier" AS ENUM('Finca', 'Italcol', 'Contegral');--> statement-breakpoint
CREATE TABLE "comercial"."clients" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comercial"."clients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"nit" text,
	"phone" text,
	"address" text,
	"maps_url" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comercial"."deliveries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comercial"."deliveries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"shift" "comercial"."delivery_shift" NOT NULL,
	"priority" "comercial"."delivery_priority" DEFAULT 'normal' NOT NULL,
	"client_id" integer NOT NULL,
	"destination_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"weight_kg" numeric(12, 2) NOT NULL,
	"status" "comercial"."delivery_status" DEFAULT 'pendiente' NOT NULL,
	"plate" text,
	"vehicle_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_quantity_positive" CHECK ("comercial"."deliveries"."quantity" > 0),
	CONSTRAINT "deliveries_weight_positive" CHECK ("comercial"."deliveries"."weight_kg" > 0)
);
--> statement-breakpoint
CREATE TABLE "comercial"."destinations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comercial"."destinations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "destinations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "comercial"."loads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comercial"."loads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"supplier" "comercial"."load_supplier" NOT NULL,
	"plate" text NOT NULL,
	"vehicle_id" integer,
	"tons" numeric(10, 3) NOT NULL,
	"cost" numeric(14, 2) NOT NULL,
	"siesa_number" text NOT NULL,
	"order_number" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loads_siesa_number_unique" UNIQUE("siesa_number"),
	CONSTRAINT "loads_tons_positive" CHECK ("comercial"."loads"."tons" > 0),
	CONSTRAINT "loads_cost_non_negative" CHECK ("comercial"."loads"."cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "comercial"."deliveries" ADD CONSTRAINT "deliveries_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "comercial"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comercial"."deliveries" ADD CONSTRAINT "deliveries_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "comercial"."destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comercial"."deliveries" ADD CONSTRAINT "deliveries_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comercial"."loads" ADD CONSTRAINT "loads_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_nit_uq" ON "comercial"."clients" USING btree ("nit") WHERE nit is not null;--> statement-breakpoint
CREATE INDEX "deliveries_date_idx" ON "comercial"."deliveries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "deliveries_client_idx" ON "comercial"."deliveries" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "deliveries_status_idx" ON "comercial"."deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loads_date_idx" ON "comercial"."loads" USING btree ("date");--> statement-breakpoint
CREATE INDEX "loads_supplier_idx" ON "comercial"."loads" USING btree ("supplier");