CREATE TYPE "comercial"."order_status" AS ENUM('pendiente', 'cargado', 'anulado');--> statement-breakpoint
CREATE TABLE "comercial"."settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comercial"."order_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comercial"."order_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"location_id" integer,
	"reference_id" integer NOT NULL,
	"bags" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "order_lines_bags_positive" CHECK ("comercial"."order_lines"."bags" > 0)
);
--> statement-breakpoint
CREATE TABLE "comercial"."order_references" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comercial"."order_references_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comercial"."orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comercial"."orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"delivery_date" date NOT NULL,
	"time_window" text,
	"note" text,
	"status" "comercial"."order_status" DEFAULT 'pendiente' NOT NULL,
	"load_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_status_matches_load" CHECK (("comercial"."orders"."status" = 'cargado') = ("comercial"."orders"."load_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "comercial"."order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "comercial"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comercial"."order_lines" ADD CONSTRAINT "order_lines_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "comercial"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comercial"."order_lines" ADD CONSTRAINT "order_lines_location_id_client_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "comercial"."client_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comercial"."order_lines" ADD CONSTRAINT "order_lines_reference_id_order_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "comercial"."order_references"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comercial"."orders" ADD CONSTRAINT "orders_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "comercial"."loads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_lines_order_idx" ON "comercial"."order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_lines_client_idx" ON "comercial"."order_lines" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_references_name_key_uq" ON "comercial"."order_references" USING btree ("name_key");--> statement-breakpoint
CREATE INDEX "orders_delivery_date_idx" ON "comercial"."orders" USING btree ("delivery_date");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "comercial"."orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_load_idx" ON "comercial"."orders" USING btree ("load_id");