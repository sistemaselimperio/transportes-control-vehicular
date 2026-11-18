ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "not_applicable_sections" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "transportes"."preoperational_inspections" SET "not_applicable_sections" = '["mule"]'::jsonb WHERE "mule_not_applicable" = true;
