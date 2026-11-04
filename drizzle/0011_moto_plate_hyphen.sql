-- Motorcycle plates (3 letters + 2 digits + 1 letter) now carry a hyphen, like car plates:
-- "ABC12D" -> "ABC-12D" (see src/modules/vehicles/domain/plate.ts). Inspections keep the plate the
-- driver typed and compare it without hyphens, so they need no change.
UPDATE "transportes"."vehicles"
SET "plate" = substr("plate", 1, 3) || '-' || substr("plate", 4)
WHERE "plate" ~ '^[A-Z]{3}[0-9]{2}[A-Z]$';
--> statement-breakpoint
UPDATE "transportes"."trips"
SET "plate" = substr("plate", 1, 3) || '-' || substr("plate", 4)
WHERE "plate" ~ '^[A-Z]{3}[0-9]{2}[A-Z]$';
