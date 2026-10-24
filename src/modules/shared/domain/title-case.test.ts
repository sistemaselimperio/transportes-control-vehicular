import { describe, expect, it } from "vitest";
import { titleCase } from "./title-case";

describe("titleCase", () => {
  it("capitalizes the first letter of each word", () => {
    expect(titleCase("PÉREZ GÓMEZ JUAN")).toBe("Pérez Gómez Juan");
    expect(titleCase("  maría   josé ")).toBe("María José");
  });

  it("keeps connectors in lowercase unless they open the name", () => {
    expect(titleCase("SAN PEDRO DE LOS MILAGROS")).toBe("San Pedro de los Milagros");
    expect(titleCase("LA UNIÓN")).toBe("La Unión");
    expect(titleCase("TRANSPORTES EL IMPERIO")).toBe("Transportes El Imperio");
    expect(titleCase("PEDRO DE LA ROSA")).toBe("Pedro de la Rosa");
  });

  it("keeps abbreviations with dots in uppercase", () => {
    expect(titleCase("BOGOTÁ, D.C.")).toBe("Bogotá, D.C.");
  });
});
