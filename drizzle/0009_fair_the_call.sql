CREATE TYPE "transportes"."exit_decision" AS ENUM('APTO', 'NO_APTO');--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "exit_decision" "transportes"."exit_decision";--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "exit_authorized_time" text;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "exit_decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "exit_decided_by" text;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "closure_date" date;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "closure_work_order" text;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "closure_action" text;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "closure_responsible" text;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "closure_recorded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "closure_recorded_by" text;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD CONSTRAINT "preoperational_inspections_exit_decided_by_user_id_fk" FOREIGN KEY ("exit_decided_by") REFERENCES "transportes"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD CONSTRAINT "preoperational_inspections_closure_recorded_by_user_id_fk" FOREIGN KEY ("closure_recorded_by") REFERENCES "transportes"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "preoperational_inspections_exit_decision_idx" ON "transportes"."preoperational_inspections" USING btree ("exit_decision");