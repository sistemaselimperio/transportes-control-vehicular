CREATE TABLE "transportes"."preoperational_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inspection_date" date NOT NULL,
	"inspection_time" text NOT NULL,
	"plate" text NOT NULL,
	"trailer_plate" text,
	"driver_name" text NOT NULL,
	"driver_national_id" text NOT NULL,
	"odometer" text NOT NULL,
	"route" text NOT NULL,
	"mule_not_applicable" boolean DEFAULT false NOT NULL,
	"answers" jsonb NOT NULL,
	"has_critical_failure" boolean DEFAULT false NOT NULL,
	"signature" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "preoperational_inspections_date_idx" ON "transportes"."preoperational_inspections" USING btree ("inspection_date","created_at");--> statement-breakpoint
CREATE INDEX "preoperational_inspections_plate_idx" ON "transportes"."preoperational_inspections" USING btree ("plate");