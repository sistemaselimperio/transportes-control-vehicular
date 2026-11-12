CREATE TYPE "transportes"."petty_cash_responsibility" AS ENUM('none_active', 'electronic_invoicer');--> statement-breakpoint
CREATE TABLE "transportes"."petty_cash_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"initial_balance" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportes"."petty_cash_expenses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."petty_cash_expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ledger_id" integer NOT NULL,
	"detail" text NOT NULL,
	"invoice_number" text,
	"nit" text NOT NULL,
	"company" text,
	"responsibility_type" "transportes"."petty_cash_responsibility",
	"vehicle_id" integer,
	"vehicle_label" text NOT NULL,
	"value" integer NOT NULL,
	"attachment_path" text,
	"attachment_name" text,
	"attachment_mime" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "petty_cash_expenses_value_positive" CHECK ("transportes"."petty_cash_expenses"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "transportes"."petty_cash_ledgers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."petty_cash_ledgers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"compense_amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportes"."petty_cash_suppliers" (
	"nit" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"responsibility_type" "transportes"."petty_cash_responsibility",
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transportes"."user" ADD COLUMN "has_petty_cash" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_accounts" ADD CONSTRAINT "petty_cash_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "transportes"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_expenses" ADD CONSTRAINT "petty_cash_expenses_ledger_id_petty_cash_ledgers_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "transportes"."petty_cash_ledgers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_expenses" ADD CONSTRAINT "petty_cash_expenses_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_ledgers" ADD CONSTRAINT "petty_cash_ledgers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "transportes"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "petty_cash_expenses_ledger_idx" ON "transportes"."petty_cash_expenses" USING btree ("ledger_id");--> statement-breakpoint
CREATE INDEX "petty_cash_ledgers_user_date_idx" ON "transportes"."petty_cash_ledgers" USING btree ("user_id","date");--> statement-breakpoint
UPDATE "transportes"."user" SET "has_petty_cash" = true WHERE "username" = 'rocio';
