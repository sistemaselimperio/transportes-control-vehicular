import { describe, expect, it } from "vitest";
import { matchesQuery, searchKey } from "./search-key";

describe("searchKey", () => {
  it("drops case, accents, spaces and punctuation", () => {
    expect(searchKey("Córdoba")).toBe("cordoba");
    expect(searchKey("900.123.456-7")).toBe("9001234567");
    expect(searchKey("  Puente  De Tierra ")).toBe("puentedetierra");
  });
});

describe("matchesQuery", () => {
  it("needs every word of the query in some field", () => {
    expect(matchesQuery(["Agro Ñandú", "900123456"], "agro nandu")).toBe(true);
    expect(matchesQuery(["Agro Ñandú", "900123456"], "agro 9001")).toBe(true);
    expect(matchesQuery(["Agro Ñandú", "900123456"], "agro zzz")).toBe(false);
  });

  it("matches everything for a blank query and skips empty fields", () => {
    expect(matchesQuery(["x"], "   ")).toBe(true);
    expect(matchesQuery([null, undefined, "Susa"], "susa")).toBe(true);
  });
});
