import { describe, expect, it } from "vitest";
import { importMessage } from "./import-message";

describe("importMessage", () => {
  it("reports the added expenses", () => {
    expect(importMessage({ added: 3, failed: 0, unreadablePages: [] })).toBe("Se agregaron 3 gastos por revisar.");
  });

  it("uses the singular for one expense", () => {
    expect(importMessage({ added: 1, failed: 0, unreadablePages: [] })).toBe("Se agregó 1 gasto por revisar.");
  });

  it("lists the pages that could not be read", () => {
    expect(importMessage({ added: 2, failed: 0, unreadablePages: [3, 7] })).toBe(
      "Se agregaron 2 gastos por revisar. No se pudieron leer las hojas: 3, 7.",
    );
    expect(importMessage({ added: 2, failed: 0, unreadablePages: [4] })).toContain("No se pudo leer la hoja: 4.");
  });

  it("says so when no invoice was found", () => {
    expect(importMessage({ added: 0, failed: 0, unreadablePages: [] })).toBe("No se encontraron facturas en el archivo.");
  });

  it("mentions the expenses that could not be saved", () => {
    expect(importMessage({ added: 1, failed: 2, unreadablePages: [] })).toBe(
      "Se agregó 1 gasto por revisar. No se pudieron guardar 2 gastos.",
    );
  });
});
