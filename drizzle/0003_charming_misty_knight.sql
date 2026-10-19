CREATE TYPE "public"."driver_status" AS ENUM('ACTIVE', 'IN_WORKSHOP', 'INACTIVE');--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "company" "owner_group";--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "status" "driver_status" DEFAULT 'ACTIVE' NOT NULL;