ALTER TABLE "transportes"."user" ADD COLUMN "role" text DEFAULT 'staff' NOT NULL;--> statement-breakpoint
UPDATE "transportes"."user" SET "role" = 'admin' WHERE "username" = 'rocio';
