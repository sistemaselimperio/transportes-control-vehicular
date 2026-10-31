ALTER TABLE "transportes"."fuel_fills" ALTER COLUMN "gallons" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."fuel_fills" ALTER COLUMN "amount" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."fuel_fills" ADD COLUMN "urea" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "transportes"."fuel_fills" ADD CONSTRAINT "fuel_fills_has_product_check" CHECK (coalesce(gallons, 0) > 0 or coalesce(urea, 0) > 0);