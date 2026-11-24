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

  it("allows one name under two codes, and one code under two suppliers", () => {
    const nodriza = bySupplier("Finca").filter((p) => p.name === "Terneras Nodriza");
    expect(nodriza.map((p) => p.code)).toEqual(["302040", "302540"]);
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
    for (const p of CATALOG_SEED) {
      expect(sql).toContain(`('${p.supplier}', '${p.code}', '${p.name.replace(/'/g, "''")}')`);
    }
  });
});
