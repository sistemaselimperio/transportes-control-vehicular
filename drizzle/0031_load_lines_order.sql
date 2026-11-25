-- Every load line now takes its product from exactly one order. There are no loads in production, so the
-- column is simply NOT NULL: this statement fails loudly if any line exists, instead of inventing data.
ALTER TABLE "comercial"."load_lines" ADD COLUMN "order_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "comercial"."load_lines" ADD CONSTRAINT "load_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "comercial"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "load_lines_order_idx" ON "comercial"."load_lines" USING btree ("order_id");--> statement-breakpoint
-- An order is loaded in parts (one load per supplier): whether it is loaded is derived from the load lines, so
-- the order no longer points at a single load and 'cargado' is no longer persisted (the enum value stays unused).
ALTER TABLE "comercial"."orders" DROP CONSTRAINT "orders_status_matches_load";--> statement-breakpoint
UPDATE "comercial"."orders" SET "status" = 'pendiente' WHERE "status" = 'cargado';--> statement-breakpoint
ALTER TABLE "comercial"."orders" DROP CONSTRAINT "orders_load_id_loads_id_fk";--> statement-breakpoint
DROP INDEX "comercial"."orders_load_idx";--> statement-breakpoint
ALTER TABLE "comercial"."orders" DROP COLUMN "load_id";
