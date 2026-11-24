-- Capacity used to be free text (tons for cargo, occupants for old rows). Only values with an explicit ton
-- unit convert to tons; bare numbers and anything else become NULL instead of failing the migration.
ALTER TABLE "transportes"."vehicles" ALTER COLUMN "capacity" SET DATA TYPE numeric(8, 2) USING (
  CASE
    WHEN "capacity" ~* '^\s*\d{1,6}([.,]\d+)?\s*(t|ton|tons|tonelada|toneladas)\.?\s*$'
    THEN NULLIF(replace(substring("capacity" from '\d+(?:[.,]\d+)?'), ',', '.')::numeric, 0)
    ELSE NULL
  END
);
