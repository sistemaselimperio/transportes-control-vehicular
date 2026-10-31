ALTER TABLE "transportes"."user" ADD COLUMN "theme" text DEFAULT 'yellow' NOT NULL;--> statement-breakpoint
UPDATE "transportes"."user" SET "theme" = 'sky' WHERE "username" = 'leidy';
