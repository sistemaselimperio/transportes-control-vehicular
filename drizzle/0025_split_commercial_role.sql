-- The shared "commercial" role is split: Sandra dispatches (deliveries), Esperanza loads (loads).
-- Only the two known users are moved. Any other row still holding 'commercial' is left untouched
-- (it parses to the least privileged role, "staff", until reassigned by hand).
UPDATE "transportes"."user" SET "role" = 'dispatcher' WHERE "username" = 'sandra' AND "role" = 'commercial';--> statement-breakpoint
UPDATE "transportes"."user" SET "role" = 'loader' WHERE "username" = 'esperanza' AND "role" = 'commercial';
