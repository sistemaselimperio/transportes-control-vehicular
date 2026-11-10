UPDATE "transportes"."trips" SET "status" = 'programado' WHERE "status" = 'en_ruta';--> statement-breakpoint
ALTER TABLE "transportes"."trips" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "transportes"."trips" ALTER COLUMN "status" SET DEFAULT 'programado'::text;--> statement-breakpoint
DROP TYPE "transportes"."trip_status";--> statement-breakpoint
CREATE TYPE "transportes"."trip_status" AS ENUM('programado', 'entregado');--> statement-breakpoint
ALTER TABLE "transportes"."trips" ALTER COLUMN "status" SET DEFAULT 'programado'::"transportes"."trip_status";--> statement-breakpoint
ALTER TABLE "transportes"."trips" ALTER COLUMN "status" SET DATA TYPE "transportes"."trip_status" USING "status"::"transportes"."trip_status";