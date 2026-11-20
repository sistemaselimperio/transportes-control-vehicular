import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT, THEME_OPTIONS, THEME_STORAGE_KEY, parseTheme } from "./theme";

describe("parseTheme", () => {
  it("keeps the known themes", () => {
    expect(parseTheme("yellow")).toBe("yellow");
    expect(parseTheme("sky")).toBe("sky");
    expect(parseTheme("orange")).toBe("orange");
  });

  it("falls back to the default yellow theme", () => {
    expect(parseTheme(undefined)).toBe("yellow");
    expect(parseTheme(null)).toBe("yellow");
    expect(parseTheme("")).toBe("yellow");
    expect(parseTheme("blue")).toBe("yellow");
    expect(parseTheme("SKY")).toBe("yellow");
  });
});

describe("THEME_OPTIONS", () => {
  it("lists yellow first, as the default, then sky and orange", () => {
    expect(THEME_OPTIONS.map((o) => o.value)).toEqual(["yellow", "sky", "orange"]);
  });
});

/** Runs the inline head script against a fake <html> and storage. */
function runInitScript(stored: string | null, storageThrows = false) {
  const dataset: Record<string, string> = {};
  const document = { documentElement: { dataset } };
  const localStorage = {
    getItem(key: string) {
      if (storageThrows) throw new Error("blocked");
      return key === THEME_STORAGE_KEY ? stored : null;
    },
  };
  new Function("document", "localStorage", THEME_INIT_SCRIPT)(document, localStorage);
  return dataset.theme;
}

describe("THEME_INIT_SCRIPT", () => {
  it("applies the stored non-default theme to <html>", () => {
    expect(runInitScript("sky")).toBe("sky");
    expect(runInitScript("orange")).toBe("orange");
  });

  it("leaves the default yellow palette when nothing or something unknown is stored", () => {
    expect(runInitScript(null)).toBeUndefined();
    expect(runInitScript("yellow")).toBeUndefined();
    expect(runInitScript("<script>")).toBeUndefined();
  });

  it("does not break the page when storage is blocked", () => {
    expect(runInitScript(null, true)).toBeUndefined();
  });
});
