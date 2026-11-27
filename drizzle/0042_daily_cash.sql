CREATE TYPE "transportes"."daily_cash_company" AS ENUM('EC1', 'EGT');--> statement-breakpoint
CREATE TYPE "transportes"."daily_cash_kind" AS ENUM('expense', 'income');--> statement-breakpoint
CREATE TYPE "transportes"."daily_cash_source" AS ENUM('import', 'manual');--> statement-breakpoint
CREATE TYPE "transportes"."daily_cash_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "transportes"."daily_cash_boxes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."daily_cash_boxes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"status" "transportes"."daily_cash_status" DEFAULT 'open' NOT NULL,
	"opening_balance" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportes"."daily_cash_counts" (
	"box_id" integer NOT NULL,
	"denomination" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "daily_cash_counts_box_id_denomination_pk" PRIMARY KEY("box_id","denomination"),
	CONSTRAINT "daily_cash_counts_quantity_positive" CHECK ("transportes"."daily_cash_counts"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "transportes"."daily_cash_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."daily_cash_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"box_id" integer NOT NULL,
	"kind" "transportes"."daily_cash_kind" NOT NULL,
	"company" "transportes"."daily_cash_company",
	"voucher_number" text,
	"detail" text NOT NULL,
	"value" integer NOT NULL,
	"source" "transportes"."daily_cash_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_cash_entries_value_positive" CHECK ("transportes"."daily_cash_entries"."value" > 0),
	CONSTRAINT "daily_cash_entries_company_by_kind" CHECK (("transportes"."daily_cash_entries"."kind" = 'expense' and "transportes"."daily_cash_entries"."company" is not null) or ("transportes"."daily_cash_entries"."kind" = 'income' and "transportes"."daily_cash_entries"."company" is null))
);
--> statement-breakpoint
ALTER TABLE "transportes"."user" ADD COLUMN "has_daily_cash" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."daily_cash_boxes" ADD CONSTRAINT "daily_cash_boxes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "transportes"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."daily_cash_counts" ADD CONSTRAINT "daily_cash_counts_box_id_daily_cash_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "transportes"."daily_cash_boxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."daily_cash_entries" ADD CONSTRAINT "daily_cash_entries_box_id_daily_cash_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "transportes"."daily_cash_boxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_cash_boxes_user_date_uq" ON "transportes"."daily_cash_boxes" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "daily_cash_entries_box_idx" ON "transportes"."daily_cash_entries" USING btree ("box_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_cash_entries_voucher_uq" ON "transportes"."daily_cash_entries" USING btree ("company","voucher_number") WHERE "transportes"."daily_cash_entries"."voucher_number" is not null;
--> statement-breakpoint
UPDATE "transportes"."user" SET "has_daily_cash" = true WHERE "username" = 'leidy';
