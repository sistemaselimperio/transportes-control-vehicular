ALTER TABLE "transportes"."user" ADD COLUMN "receives_parked_trip_alerts" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "transportes"."user" SET "receives_parked_trip_alerts" = true WHERE "username" = 'rocio';
