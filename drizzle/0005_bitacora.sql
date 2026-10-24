CREATE TYPE "public"."service_kind" AS ENUM('PREVENTIVE', 'CORRECTIVE');--> statement-breakpoint
CREATE TABLE "fuel_fills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fuel_fills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"date" date NOT NULL,
	"gallons" numeric(8, 2) NOT NULL,
	"amount" integer NOT NULL,
	"provider" text
);
--> statement-breakpoint
CREATE TABLE "oil_change_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "oil_change_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"oil_change_id" integer NOT NULL,
	"quantity" numeric(8, 2) NOT NULL,
	"detail" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tire_changes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tire_changes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"date" date NOT NULL,
	"quantity" integer NOT NULL,
	"reference" text NOT NULL,
	"provider" text,
	"price" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "vehicle_services" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicle_services_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"date" date NOT NULL,
	"kind" "service_kind" NOT NULL,
	"description" text NOT NULL,
	"provider" text,
	"km" integer,
	"price" integer,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "oil_changes" ADD COLUMN "price" integer;--> statement-breakpoint
ALTER TABLE "fuel_fills" ADD CONSTRAINT "fuel_fills_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oil_change_items" ADD CONSTRAINT "oil_change_items_oil_change_id_oil_changes_id_fk" FOREIGN KEY ("oil_change_id") REFERENCES "public"."oil_changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tire_changes" ADD CONSTRAINT "tire_changes_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_services" ADD CONSTRAINT "vehicle_services_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fuel_fills_vehicle_date_idx" ON "fuel_fills" USING btree ("vehicle_id","date");--> statement-breakpoint
CREATE INDEX "oil_change_items_oil_change_idx" ON "oil_change_items" USING btree ("oil_change_id");--> statement-breakpoint
CREATE INDEX "tire_changes_vehicle_date_idx" ON "tire_changes" USING btree ("vehicle_id","date");--> statement-breakpoint
CREATE INDEX "vehicle_services_vehicle_date_idx" ON "vehicle_services" USING btree ("vehicle_id","date");