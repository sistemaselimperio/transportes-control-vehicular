ALTER TABLE "transportes"."petty_cash_ledgers" ADD COLUMN "number" integer;--> statement-breakpoint
UPDATE "transportes"."petty_cash_ledgers" AS l SET "number" = n."rn" FROM (SELECT "id", row_number() OVER (PARTITION BY "user_id" ORDER BY "date", "id") AS "rn" FROM "transportes"."petty_cash_ledgers") AS n WHERE l."id" = n."id";--> statement-breakpoint
ALTER TABLE "transportes"."petty_cash_ledgers" ALTER COLUMN "number" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "petty_cash_ledgers_user_number_uq" ON "transportes"."petty_cash_ledgers" USING btree ("user_id","number");
