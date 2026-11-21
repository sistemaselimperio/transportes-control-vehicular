-- Deliveries pick a municipality like trips do: the label is stored as text instead of pointing
-- at the editable comercial.destinations list, which goes away. Existing rows keep their data.
ALTER TABLE "comercial"."deliveries" ADD COLUMN "destination" text;--> statement-breakpoint
UPDATE "comercial"."deliveries" AS d SET "destination" = CASE x."name"
  WHEN 'Albania' THEN 'Albania (Santander)'
  WHEN 'San Miguel' THEN 'San Miguel de Sema (Boyacá)'
  WHEN 'Simijaca' THEN 'Simijaca (Cundinamarca)'
  WHEN 'Ubaté' THEN 'Villa de San Diego de Ubaté (Cundinamarca)'
  ELSE x."name"
END
FROM "comercial"."destinations" AS x WHERE x."id" = d."destination_id";--> statement-breakpoint
ALTER TABLE "comercial"."deliveries" ALTER COLUMN "destination" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "comercial"."deliveries" DROP CONSTRAINT "deliveries_destination_id_destinations_id_fk";--> statement-breakpoint
ALTER TABLE "comercial"."deliveries" DROP COLUMN "destination_id";--> statement-breakpoint
ALTER TABLE "comercial"."destinations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "comercial"."destinations" CASCADE;
