CREATE TABLE "comercial"."load_balance_trips" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comercial"."load_balance_trips_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"balance_id" integer NOT NULL,
	"date" date NOT NULL,
	"plate" text NOT NULL,
	"vehicle_id" integer,
	"bags" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "load_balance_trips_bags_positive" CHECK ("comercial"."load_balance_trips"."bags" > 0)
);
--> statement-breakpoint
CREATE TABLE "comercial"."load_balances" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comercial"."load_balances_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"load_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"bags" integer NOT NULL,
	"scheduled_date" date NOT NULL,
	"plate" text,
	"vehicle_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "load_balances_bags_positive" CHECK ("comercial"."load_balances"."bags" > 0)
);
--> statement-breakpoint
ALTER TABLE "comercial"."load_balance_trips" ADD CONSTRAINT "load_balance_trips_balance_id_load_balances_id_fk" FOREIGN KEY ("balance_id") REFERENCES "comercial"."load_balances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comercial"."load_balance_trips" ADD CONSTRAINT "load_balance_trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comercial"."load_balances" ADD CONSTRAINT "load_balances_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "comercial"."loads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comercial"."load_balances" ADD CONSTRAINT "load_balances_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "comercial"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comercial"."load_balances" ADD CONSTRAINT "load_balances_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "load_balance_trips_balance_idx" ON "comercial"."load_balance_trips" USING btree ("balance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "load_balances_load_order_uq" ON "comercial"."load_balances" USING btree ("load_id","order_id");--> statement-breakpoint
CREATE INDEX "load_balances_order_idx" ON "comercial"."load_balances" USING btree ("order_id");