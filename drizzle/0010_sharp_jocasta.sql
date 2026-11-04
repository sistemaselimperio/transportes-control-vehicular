CREATE TYPE "transportes"."trip_area" AS ENUM('Traslados', 'Cemento', 'Ganadería', 'Ruta Ricaurte', 'Abono', 'Concentrado', 'Combustible', 'Trasolicar');--> statement-breakpoint
CREATE TYPE "transportes"."trip_status" AS ENUM('programado', 'en_ruta', 'entregado');--> statement-breakpoint
CREATE TABLE "transportes"."trips" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."trips_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"start_at" timestamp with time zone NOT NULL,
	"destination" text NOT NULL,
	"plate" text NOT NULL,
	"vehicle_id" integer,
	"area" "transportes"."trip_area" NOT NULL,
	"status" "transportes"."trip_status" DEFAULT 'programado' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transportes"."trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trips_start_at_idx" ON "transportes"."trips" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "trips_vehicle_idx" ON "transportes"."trips" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "trips_status_idx" ON "transportes"."trips" USING btree ("status");