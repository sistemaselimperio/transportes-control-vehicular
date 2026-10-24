-- Owner and driver names move from uppercase to title case, mirroring `titleCase`
-- in src/modules/shared/domain/title-case.ts: "PEDRO DE LA ROSA" -> "Pedro de la Rosa".
-- Accented letters are mapped with translate() because a "C" collation (PGlite)
-- only changes the case of ASCII letters.
CREATE FUNCTION pg_temp.title_case(name text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT string_agg(
    CASE
      WHEN t.ord > 1 AND t.word IN ('de', 'del', 'la', 'las', 'los', 'y') THEN t.word
      WHEN position('.' IN t.word) > 0 THEN translate(upper(t.word), 'áéíóúüñ', 'ÁÉÍÓÚÜÑ')
      ELSE translate(upper(left(t.word, 1)), 'áéíóúüñ', 'ÁÉÍÓÚÜÑ') || substr(t.word, 2)
    END,
    ' ' ORDER BY t.ord
  )
  FROM unnest(string_to_array(
    translate(lower(regexp_replace(btrim(name), '\s+', ' ', 'g')), 'ÁÉÍÓÚÜÑ', 'áéíóúüñ'),
    ' '
  )) WITH ORDINALITY AS t(word, ord)
$$;
--> statement-breakpoint
UPDATE "owners" SET "name" = pg_temp.title_case("name") WHERE "name" <> pg_temp.title_case("name");
--> statement-breakpoint
UPDATE "drivers" SET "name" = pg_temp.title_case("name") WHERE "name" <> pg_temp.title_case("name");
