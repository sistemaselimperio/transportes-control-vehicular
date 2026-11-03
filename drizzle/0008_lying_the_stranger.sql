ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "vehicle_id" integer;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "trailer_vehicle_id" integer;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD COLUMN "driver_id" integer;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD CONSTRAINT "preoperational_inspections_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD CONSTRAINT "preoperational_inspections_trailer_vehicle_id_vehicles_id_fk" FOREIGN KEY ("trailer_vehicle_id") REFERENCES "transportes"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportes"."preoperational_inspections" ADD CONSTRAINT "preoperational_inspections_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "transportes"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "preoperational_inspections_vehicle_idx" ON "transportes"."preoperational_inspections" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "preoperational_inspections_trailer_vehicle_idx" ON "transportes"."preoperational_inspections" USING btree ("trailer_vehicle_id");--> statement-breakpoint
CREATE INDEX "preoperational_inspections_driver_idx" ON "transportes"."preoperational_inspections" USING btree ("driver_id");--> statement-breakpoint
-- One-time backfill of the soft links. The keys mirror `normalizePlateKey` / `normalizeNationalIdKey`
-- (src/modules/inspections/domain/inspection-links.ts); a key matching no record or several stays NULL.
UPDATE "transportes"."preoperational_inspections" AS i SET
  "vehicle_id" = (
    SELECT CASE WHEN count(*) = 1 THEN min(v."id") END
    FROM "transportes"."vehicles" AS v
    WHERE regexp_replace(upper(i."plate"), '[\s.-]+', '', 'g') <> ''
      AND regexp_replace(upper(v."plate"), '[\s.-]+', '', 'g') = regexp_replace(upper(i."plate"), '[\s.-]+', '', 'g')
  ),
  "trailer_vehicle_id" = (
    SELECT CASE WHEN count(*) = 1 THEN min(v."id") END
    FROM "transportes"."vehicles" AS v
    WHERE regexp_replace(upper(coalesce(i."trailer_plate", '')), '[\s.-]+', '', 'g') <> ''
      AND regexp_replace(upper(v."plate"), '[\s.-]+', '', 'g') = regexp_replace(upper(coalesce(i."trailer_plate", '')), '[\s.-]+', '', 'g')
  ),
  "driver_id" = (
    SELECT CASE WHEN count(*) = 1 THEN min(d."id") END
    FROM "transportes"."drivers" AS d
    WHERE regexp_replace(i."driver_national_id", '\D+', '', 'g') <> ''
      AND regexp_replace(coalesce(d."national_id", ''), '\D+', '', 'g') = regexp_replace(i."driver_national_id", '\D+', '', 'g')
  );
