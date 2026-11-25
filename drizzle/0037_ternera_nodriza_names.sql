-- Names the Finca Ternera Nodriza presentations as the loader knows them: P (pellet) and ESP (extruded).
UPDATE "comercial"."order_references" SET "name" = 'Ternera Nodriza P' WHERE "supplier" = 'Finca' AND "code" = '302040';--> statement-breakpoint
UPDATE "comercial"."order_references" SET "name" = 'Ternera Nodriza ESP' WHERE "supplier" = 'Finca' AND "code" = '302540';
