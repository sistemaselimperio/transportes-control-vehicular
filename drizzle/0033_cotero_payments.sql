CREATE TYPE "transportes"."cotero_receipt_status" AS ENUM('pending', 'settled', 'paid');--> statement-breakpoint
CREATE TYPE "transportes"."cotero_settlement_status" AS ENUM('open', 'paid', 'annulled');--> statement-breakpoint
CREATE TABLE "transportes"."cotero_profiles" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"document" text,
	"payment_method" text,
	"payment_account" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportes"."cotero_receipts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."cotero_receipts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"receipt_number" text NOT NULL,
	"date" date NOT NULL,
	"destination" text DEFAULT '' NOT NULL,
	"remissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"tons" numeric(10, 3) NOT NULL,
	"vehicle_plate" text NOT NULL,
	"trailer_plate" text,
	"crew" text,
	"cotero_key" text NOT NULL,
	"cotero_name" text NOT NULL,
	"cotero_document" text,
	"driver_name" text DEFAULT '' NOT NULL,
	"amount" integer NOT NULL,
	"tariff_per_ton" integer,
	"expected_amount" integer,
	"amount_mismatch" boolean DEFAULT false NOT NULL,
	"file_path" text,
	"page_number" integer,
	"status" "transportes"."cotero_receipt_status" DEFAULT 'pending' NOT NULL,
	"settlement_id" integer,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotero_receipts_amount_positive" CHECK ("transportes"."cotero_receipts"."amount" > 0),
	CONSTRAINT "cotero_receipts_tons_positive" CHECK ("transportes"."cotero_receipts"."tons" > 0)
);
--> statement-breakpoint
CREATE TABLE "transportes"."cotero_settlements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."cotero_settlements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" integer NOT NULL,
	"date" date NOT NULL,
	"cotero_key" text NOT NULL,
	"cotero_name" text NOT NULL,
	"cotero_document" text,
	"payment_method" text,
	"payment_account" text,
	"total" integer NOT NULL,
	"status" "transportes"."cotero_settlement_status" DEFAULT 'open' NOT NULL,
	"paid_at" date,
	"proof_path" text,
	"annulled_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportes"."cotero_tariffs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."cotero_tariffs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"valid_from" date NOT NULL,
	"price_per_ton" integer NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotero_tariffs_price_positive" CHECK ("transportes"."cotero_tariffs"."price_per_ton" > 0)
);
--> statement-breakpoint
ALTER TABLE "transportes"."user" ADD COLUMN "has_cotero_payments" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."cotero_receipts" ADD CONSTRAINT "cotero_receipts_settlement_id_cotero_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "transportes"."cotero_settlements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."cotero_receipts" ADD CONSTRAINT "cotero_receipts_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "transportes"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."cotero_settlements" ADD CONSTRAINT "cotero_settlements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "transportes"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."cotero_tariffs" ADD CONSTRAINT "cotero_tariffs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "transportes"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cotero_receipts_number_uq" ON "transportes"."cotero_receipts" USING btree ("receipt_number");--> statement-breakpoint
CREATE INDEX "cotero_receipts_cotero_status_idx" ON "transportes"."cotero_receipts" USING btree ("cotero_key","status");--> statement-breakpoint
CREATE INDEX "cotero_receipts_date_idx" ON "transportes"."cotero_receipts" USING btree ("date");--> statement-breakpoint
CREATE INDEX "cotero_receipts_settlement_idx" ON "transportes"."cotero_receipts" USING btree ("settlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cotero_settlements_number_uq" ON "transportes"."cotero_settlements" USING btree ("number");--> statement-breakpoint
CREATE INDEX "cotero_settlements_cotero_idx" ON "transportes"."cotero_settlements" USING btree ("cotero_key");--> statement-breakpoint
CREATE UNIQUE INDEX "cotero_tariffs_valid_from_uq" ON "transportes"."cotero_tariffs" USING btree ("valid_from");
--> statement-breakpoint
INSERT INTO "transportes"."cotero_tariffs" ("valid_from", "price_per_ton") VALUES ('2026-01-01', 9800);--> statement-breakpoint
UPDATE "transportes"."user" SET "has_cotero_payments" = true WHERE "username" = 'leidy';
