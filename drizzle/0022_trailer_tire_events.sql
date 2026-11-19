CREATE TYPE "transportes"."tire_condition" AS ENUM('GOOD', 'FAIR', 'BAD');--> statement-breakpoint
CREATE TYPE "transportes"."trailer_tire_event_type" AS ENUM('CHANGE', 'REPAIR', 'ROTATION', 'INSPECTION');--> statement-breakpoint
CREATE TABLE "transportes"."trailer_tire_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."trailer_tire_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"position" text NOT NULL,
	"type" "transportes"."trailer_tire_event_type" NOT NULL,
	"date" date NOT NULL,
	"reference" text,
	"provider" text,
	"price" integer,
	"notes" text,
	"counterpart_position" text,
	"tread_depth_mm" numeric(4, 1),
	"pressure_psi" numeric(5, 1),
	"condition" "transportes"."tire_condition",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trailer_tire_events_rotation_differs_check" CHECK (counterpart_position is null or counterpart_position <> position)
);
--> statement-breakpoint
ALTER TABLE "transportes"."trailer_tire_events" ADD CONSTRAINT "trailer_tire_events_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trailer_tire_events_vehicle_position_date_idx" ON "transportes"."trailer_tire_events" USING btree ("vehicle_id","position","date");