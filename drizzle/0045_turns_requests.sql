-- Turns become requests (product, place, needed hour) that an admin assigns a vehicle to.
-- Existing rows are test data: drop them so the new columns can be NOT NULL.
DELETE FROM "transportes"."turns";--> statement-breakpoint
DROP INDEX "transportes"."turns_day_vehicle_active_uq";--> statement-breakpoint
ALTER TABLE "transportes"."turns" ALTER COLUMN "vehicle_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."turns" DROP COLUMN "position";--> statement-breakpoint
ALTER TABLE "transportes"."turns" ALTER COLUMN "destination" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."turns" ADD COLUMN "product" text NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."turns" ADD COLUMN "needed_at" timestamp with time zone NOT NULL;
