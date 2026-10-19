import { describe, expect, it } from "vitest";
import { FILE_TABS, parseTabParam } from "./file-tabs";

describe("parseTabParam", () => {
  it("accepts every known tab", () => {
    for (const { key } of FILE_TABS) expect(parseTabParam(key)).toBe(key);
  });

  it("uses the first value of a repeated param", () => {
    expect(parseTabParam(["historial", "personas"])).toBe("historial");
  });

  it("falls back to the summary", () => {
    expect(parseTabParam("nope")).toBe("resumen");
    expect(parseTabParam(undefined)).toBe("resumen");
  });
});
