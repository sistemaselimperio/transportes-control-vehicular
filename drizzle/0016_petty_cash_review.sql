ALTER TABLE "transportes"."petty_cash_expenses" ALTER COLUMN "nit" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_expenses" ALTER COLUMN "vehicle_label" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_expenses" ALTER COLUMN "value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_expenses" ADD COLUMN "supplier_name" text;--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_expenses" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_expenses" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_expenses" ADD COLUMN "possible_duplicate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_suppliers" ADD COLUMN "supplier_name" text;--> statement-breakpoint
UPDATE "transportes"."petty_cash_suppliers" SET "supplier_name" = "company";--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_suppliers" DROP COLUMN "company";--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_expenses" ADD CONSTRAINT "petty_cash_expenses_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "transportes"."owners"("id") ON DELETE set null ON UPDATE no action;