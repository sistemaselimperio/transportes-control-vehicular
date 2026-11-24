-- Capacity used to be free text recorded in kilos ("15000 KILO", "8000"), with a few occupant counts ("2")
-- and junk. Mirrors parseLegacyCapacityTons: an explicit ton unit stays as is, kilos (with a unit or a bare
-- number >= 100) are divided by 1000, everything else becomes NULL instead of failing the migration.
ALTER TABLE "transportes"."vehicles" ALTER COLUMN "capacity" SET DATA TYPE numeric(8, 2) USING (
  NULLIF(round(
    CASE
      WHEN "capacity" ~* '^\s*\d{1,6}([.,]\d+)?\s*(t|ton|tons|tonelada|toneladas)\.?\s*$'
      THEN replace(substring("capacity" from '\d+(?:[.,]\d+)?'), ',', '.')::numeric
      WHEN "capacity" ~* '^\s*\d{1,9}([.,]\d+)?\s*(kg|kgs|kilo|kilos|kilogramo|kilogramos)\.?\s*$'
      THEN replace(substring("capacity" from '\d+(?:[.,]\d+)?'), ',', '.')::numeric / 1000
      WHEN "capacity" ~ '^\s*\d{1,9}([.,]\d+)?\s*$'
      THEN CASE
        WHEN replace(btrim("capacity"), ',', '.')::numeric >= 100
        THEN replace(btrim("capacity"), ',', '.')::numeric / 1000
      END
      ELSE NULL
    END, 2), 0)
);
