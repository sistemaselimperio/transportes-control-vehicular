ALTER TABLE "transportes"."cotero_receipts" ADD COLUMN "vehicle_id" integer;--> statement-breakpoint
ALTER TABLE "transportes"."cotero_receipts" ADD COLUMN "trailer_id" integer;--> statement-breakpoint
ALTER TABLE "transportes"."cotero_receipts" ADD COLUMN "driver_id" integer;--> statement-breakpoint
ALTER TABLE "transportes"."cotero_receipts" ADD CONSTRAINT "cotero_receipts_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."cotero_receipts" ADD CONSTRAINT "cotero_receipts_trailer_id_vehicles_id_fk" FOREIGN KEY ("trailer_id") REFERENCES "transportes"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."cotero_receipts" ADD CONSTRAINT "cotero_receipts_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "transportes"."drivers"("id") ON DELETE set null ON UPDATE no action;