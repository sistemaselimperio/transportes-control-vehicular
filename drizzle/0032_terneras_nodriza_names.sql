-- 302040 is the pellet (P) and 302540 the extruded (E) presentation of Terneras Nodriza: both were saved with the same name.
UPDATE "comercial"."order_references" SET "name" = 'Terneras Nodriza P' WHERE "supplier" = 'Finca' AND "code" = '302040';--> statement-breakpoint
UPDATE "comercial"."order_references" SET "name" = 'Terneras Nodriza E' WHERE "supplier" = 'Finca' AND "code" = '302540';
