ALTER TABLE "transportes"."vehicle_files" ALTER COLUMN "storage_path" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."vehicle_files" DROP COLUMN "data";