CREATE TABLE "transportes"."turn_days" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."turn_days_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "turn_days_window_valid" CHECK ("transportes"."turn_days"."opens_at" < "transportes"."turn_days"."closes_at")
);
--> statement-breakpoint
CREATE TABLE "transportes"."turns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transportes"."turns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"turn_day_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"destination" text,
	"position" integer NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text
);
--> statement-breakpoint
ALTER TABLE "transportes"."user" ADD COLUMN "can_admin_turns" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."user" ADD COLUMN "can_enturn" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transportes"."turn_days" ADD CONSTRAINT "turn_days_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "transportes"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."turns" ADD CONSTRAINT "turns_turn_day_id_turn_days_id_fk" FOREIGN KEY ("turn_day_id") REFERENCES "transportes"."turn_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."turns" ADD CONSTRAINT "turns_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."turns" ADD CONSTRAINT "turns_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "transportes"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."turns" ADD CONSTRAINT "turns_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "transportes"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "turn_days_date_uq" ON "transportes"."turn_days" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "turns_day_vehicle_active_uq" ON "transportes"."turns" USING btree ("turn_day_id","vehicle_id") WHERE "transportes"."turns"."cancelled_at" is null;--> statement-breakpoint
CREATE INDEX "turns_day_idx" ON "transportes"."turns" USING btree ("turn_day_id");--> statement-breakpoint
UPDATE "transportes"."user" SET "can_admin_turns" = true WHERE "username" = 'leidy';--> statement-breakpoint
UPDATE "transportes"."user" SET "can_enturn" = true WHERE "username" = 'rocio';
