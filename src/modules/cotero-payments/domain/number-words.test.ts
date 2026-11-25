import { describe, expect, it } from "vitest";
import { pesosInWords } from "./number-words";

describe("pesosInWords", () => {
  it("writes the amount of the sample receipt", () => {
    expect(pesosInWords(325498)).toBe("TRESCIENTOS VEINTICINCO MIL CUATROCIENTOS NOVENTA Y OCHO PESOS");
  });

  it("uses DE PESOS after an exact number of millions", () => {
    expect(pesosInWords(1000000)).toBe("UN MILLÓN DE PESOS");
    expect(pesosInWords(2000000)).toBe("DOS MILLONES DE PESOS");
    expect(pesosInWords(1000000000000 / 1000)).toBe("MIL MILLONES DE PESOS");
  });

  it("writes millions followed by thousands and units", () => {
    expect(pesosInWords(1325498)).toBe("UN MILLÓN TRESCIENTOS VEINTICINCO MIL CUATROCIENTOS NOVENTA Y OCHO PESOS");
    expect(pesosInWords(2500000)).toBe("DOS MILLONES QUINIENTOS MIL PESOS");
  });

  it("handles the small numbers", () => {
    expect(pesosInWords(0)).toBe("CERO PESOS");
    expect(pesosInWords(1)).toBe("UN PESO");
    expect(pesosInWords(15)).toBe("QUINCE PESOS");
    expect(pesosInWords(21)).toBe("VEINTIÚN PESOS");
    expect(pesosInWords(30)).toBe("TREINTA PESOS");
    expect(pesosInWords(31)).toBe("TREINTA Y UN PESOS");
    expect(pesosInWords(100)).toBe("CIEN PESOS");
    expect(pesosInWords(101)).toBe("CIENTO UN PESOS");
    expect(pesosInWords(999)).toBe("NOVECIENTOS NOVENTA Y NUEVE PESOS");
  });

  it("writes thousands without UN before MIL", () => {
    expect(pesosInWords(1000)).toBe("MIL PESOS");
    expect(pesosInWords(1001)).toBe("MIL UN PESOS");
    expect(pesosInWords(2000)).toBe("DOS MIL PESOS");
    expect(pesosInWords(21000)).toBe("VEINTIÚN MIL PESOS");
    expect(pesosInWords(31000)).toBe("TREINTA Y UN MIL PESOS");
    expect(pesosInWords(100000)).toBe("CIEN MIL PESOS");
    expect(pesosInWords(126224)).toBe("CIENTO VEINTISÉIS MIL DOSCIENTOS VEINTICUATRO PESOS");
  });

  it("writes the accented twenties", () => {
    expect(pesosInWords(22)).toBe("VEINTIDÓS PESOS");
    expect(pesosInWords(23)).toBe("VEINTITRÉS PESOS");
    expect(pesosInWords(26)).toBe("VEINTISÉIS PESOS");
  });

  it("ends with UN before MILLONES too", () => {
    expect(pesosInWords(21000000)).toBe("VEINTIÚN MILLONES DE PESOS");
    expect(pesosInWords(1500000)).toBe("UN MILLÓN QUINIENTOS MIL PESOS");
  });

  it("rejects negatives, decimals and unsafe numbers", () => {
    expect(() => pesosInWords(-1)).toThrow();
    expect(() => pesosInWords(1.5)).toThrow();
    expect(() => pesosInWords(1e15)).toThrow();
  });
});
