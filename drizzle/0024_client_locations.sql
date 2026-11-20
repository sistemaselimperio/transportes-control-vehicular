CREATE TABLE "comercial"."client_locations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comercial"."client_locations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" integer NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"address" text,
	"maps_url" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comercial"."clients" ADD COLUMN "name_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "comercial"."deliveries" ADD COLUMN "location_id" integer;--> statement-breakpoint
ALTER TABLE "comercial"."client_locations" ADD CONSTRAINT "client_locations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "comercial"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_locations_client_name_uq" ON "comercial"."client_locations" USING btree ("client_id","name_key");--> statement-breakpoint
ALTER TABLE "comercial"."deliveries" ADD CONSTRAINT "deliveries_location_id_client_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "comercial"."client_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deliveries_location_idx" ON "comercial"."deliveries" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_name_key_uq" ON "comercial"."clients" USING btree ("name_key");--> statement-breakpoint
ALTER TABLE "comercial"."clients" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "comercial"."clients" DROP COLUMN "maps_url";--> statement-breakpoint
ALTER TABLE "comercial"."clients" DROP COLUMN "latitude";--> statement-breakpoint
ALTER TABLE "comercial"."clients" DROP COLUMN "longitude";
