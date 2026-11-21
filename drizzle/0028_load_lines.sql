CREATE TABLE "comercial"."load_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comercial"."load_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"load_id" integer NOT NULL,
	"reference_id" integer,
	"tons" numeric(10, 3) NOT NULL,
	"cost" numeric(14, 2) NOT NULL,
	"siesa_number" text NOT NULL,
	"order_number" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "load_lines_siesa_number_unique" UNIQUE("siesa_number"),
	CONSTRAINT "load_lines_tons_positive" CHECK ("comercial"."load_lines"."tons" > 0),
	CONSTRAINT "load_lines_cost_non_negative" CHECK ("comercial"."load_lines"."cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "comercial"."load_lines" ADD CONSTRAINT "load_lines_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "comercial"."loads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comercial"."load_lines" ADD CONSTRAINT "load_lines_reference_id_order_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "comercial"."order_references"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "load_lines_load_idx" ON "comercial"."load_lines" USING btree ("load_id");--> statement-breakpoint
-- Every existing load becomes a header with one product line (no product yet) carrying its tons, cost and numbers.
INSERT INTO "comercial"."load_lines" ("load_id", "reference_id", "tons", "cost", "siesa_number", "order_number", "position")
SELECT "id", NULL, "tons", "cost", "siesa_number", "order_number", 0 FROM "comercial"."loads" ORDER BY "id";--> statement-breakpoint
ALTER TABLE "comercial"."loads" DROP CONSTRAINT "loads_siesa_number_unique";--> statement-breakpoint
ALTER TABLE "comercial"."loads" DROP CONSTRAINT "loads_tons_positive";--> statement-breakpoint
ALTER TABLE "comercial"."loads" DROP CONSTRAINT "loads_cost_non_negative";--> statement-breakpoint
ALTER TABLE "comercial"."loads" DROP COLUMN "tons";--> statement-breakpoint
ALTER TABLE "comercial"."loads" DROP COLUMN "cost";--> statement-breakpoint
ALTER TABLE "comercial"."loads" DROP COLUMN "siesa_number";--> statement-breakpoint
ALTER TABLE "comercial"."loads" DROP COLUMN "order_number";