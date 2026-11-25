import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG_SEED } from "./catalog-data";

const bySupplier = (supplier: string) => CATALOG_SEED.filter((p) => p.supplier === supplier);

describe("CATALOG_SEED", () => {
  it("holds the products of each price list", () => {
    expect(bySupplier("Finca")).toHaveLength(93);
    expect(bySupplier("Contegral")).toHaveLength(103);
    expect(bySupplier("Italcol")).toHaveLength(0);
    expect(CATALOG_SEED).toHaveLength(196);
  });

  it("never repeats a code inside a supplier", () => {
    for (const supplier of ["Finca", "Contegral"]) {
      const codes = bySupplier(supplier).map((p) => p.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it("keeps the codes verbatim, letter suffixes included", () => {
    const contegral = bySupplier("Contegral").map((p) => p.code);
    expect(contegral).toContain("350540C");
    expect(contegral).toContain("389520F");
    expect(CATALOG_SEED.every((p) => /^\d{6}[A-Z]?$/.test(p.code))).toBe(true);
  });

  it("tells the pellet and extruded presentations apart, and allows one code under two suppliers", () => {
    const nodriza = bySupplier("Finca").filter((p) => p.name.startsWith("Ternera Nodriza"));
    expect(nodriza.map((p) => [p.code, p.name])).toEqual([
      ["302040", "Ternera Nodriza P"],
      ["302540", "Ternera Nodriza ESP"],
    ]);
    const finca = bySupplier("Finca").find((p) => p.code === "132240");
    const contegral = bySupplier("Contegral").find((p) => p.code === "132240");
    expect(finca?.name).not.toBe(contegral?.name);
  });

  it("has clean names", () => {
    for (const p of CATALOG_SEED) {
      expect(p.name).toBe(p.name.trim().replace(/\s+/g, " "));
      expect(p.name).not.toMatch(/\*\*|NUEVO PROTEINADO/);
      expect(p.name).not.toBe("");
    }
  });

  it("is inserted by the catalog migration, idempotently", () => {
    const dir = join(process.cwd(), "drizzle");
    const file = readdirSync(dir).find((f) => /^0029_.*\.sql$/.test(f));
    expect(file).toBeDefined();
    const sql = readFileSync(join(dir, file as string), "utf8");
    expect(sql).toContain('ON CONFLICT ("supplier","code") DO NOTHING');
    // A later migration may rename a product: the seed holds the name it ends with.
    const renames = new Map<string, string>();
    for (const later of readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f) && f > (file as string)).sort()) {
      const text = readFileSync(join(dir, later), "utf8");
      for (const m of text.matchAll(/SET "name" = '([^']+)' WHERE "supplier" = '([^']+)' AND "code" = '([^']+)'/g)) {
        renames.set(`${m[2]}|${m[3]}`, m[1] as string);
      }
    }
    for (const p of CATALOG_SEED) {
      const renamed = renames.get(`${p.supplier}|${p.code}`);
      if (renamed !== undefined) expect(renamed).toBe(p.name);
      else expect(sql).toContain(`('${p.supplier}', '${p.code}', '${p.name.replace(/'/g, "''")}')`);
    }
  });
});
