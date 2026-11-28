-- Let Esperanza and Sandra request turns (product, place and hour) in Enturnamientos.
UPDATE "transportes"."user" SET "can_enturn" = true WHERE "username" IN ('esperanza', 'sandra');
