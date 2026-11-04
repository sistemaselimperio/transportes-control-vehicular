import { describe, expect, it } from "vitest";
import { HISTORY_TABS, parseHistoryTab } from "./history-tab";

describe("parseHistoryTab", () => {
  it("lists the tabs in display order", () => {
    expect(HISTORY_TABS.map((t) => t.key)).toEqual(["preoperacionales", "viajes", "bitacora"]);
  });

  it("accepts each known value", () => {
    expect(parseHistoryTab("preoperacionales")).toBe("preoperacionales");
    expect(parseHistoryTab("viajes")).toBe("viajes");
    expect(parseHistoryTab("bitacora")).toBe("bitacora");
  });

  it("falls back to the bitacora when missing or unknown", () => {
    expect(parseHistoryTab(undefined)).toBe("bitacora");
    expect(parseHistoryTab("")).toBe("bitacora");
    expect(parseHistoryTab("nope")).toBe("bitacora");
  });

  it("reads the first value of a repeated param", () => {
    expect(parseHistoryTab(["viajes", "bitacora"])).toBe("viajes");
  });
});
