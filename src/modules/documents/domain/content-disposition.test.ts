import { describe, expect, it } from "vitest";
import { inlineContentDisposition } from "./content-disposition";

describe("inlineContentDisposition", () => {
  it("keeps a plain ASCII name", () => {
    expect(inlineContentDisposition("soat.pdf")).toBe(`inline; filename="soat.pdf"; filename*=UTF-8''soat.pdf`);
  });

  it("encodes accents for filename* and falls back to ASCII for filename", () => {
    const header = inlineContentDisposition("Póliza ñandú.pdf");
    expect(header).toContain(`filename="P_liza _and_.pdf"`);
    expect(header).toContain("filename*=UTF-8''P%C3%B3liza%20%C3%B1and%C3%BA.pdf");
  });

  it("cannot be broken out of with quotes or control characters", () => {
    const header = inlineContentDisposition('a"b\r\nX: y.pdf');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).toContain(`filename="a_b__X: y.pdf"`);
    expect(header).toContain("%22");
  });
});
