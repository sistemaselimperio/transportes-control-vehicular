CREATE TYPE "public"."file_category" AS ENUM('POLICY', 'SOAT', 'TECNO', 'TAX', 'LOGBOOK', 'OWNERSHIP_CARD');--> statement-breakpoint
CREATE TABLE "vehicle_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" integer NOT NULL,
	"category" "file_category" NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicle_files" ADD CONSTRAINT "vehicle_files_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_files_vehicle_category_idx" ON "vehicle_files" USING btree ("vehicle_id","category");