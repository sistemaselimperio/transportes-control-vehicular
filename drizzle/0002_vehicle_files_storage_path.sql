ALTER TABLE "transportes"."vehicle_files" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."vehicle_files" ADD COLUMN "storage_path" text;