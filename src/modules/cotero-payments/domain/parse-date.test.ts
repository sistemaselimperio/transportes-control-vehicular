import { describe, expect, it } from "vitest";
import { parseColombianDate } from "./parse-date";

describe("parseColombianDate", () => {
  it("reads day, month and year in that order", () => {
    expect(parseColombianDate("11/11/2026")).toBe("2026-11-11");
    expect(parseColombianDate("1/3/2026")).toBe("2026-03-01");
    expect(parseColombianDate("05-12-2026")).toBe("2026-12-05");
    expect(parseColombianDate("5.12.2026")).toBe("2026-12-05");
    expect(parseColombianDate(" 5 / 12 / 2026 ")).toBe("2026-12-05");
  });

  it("completes a two digit year into the 2000s", () => {
    expect(parseColombianDate("11/11/26")).toBe("2026-11-11");
  });

  it("keeps an ISO date as it is", () => {
    expect(parseColombianDate("2026-11-11")).toBe("2026-11-11");
  });

  it("is empty for dates that do not exist or are not dates", () => {
    expect(parseColombianDate("31/02/2026")).toBe("");
    expect(parseColombianDate("13/13/2026")).toBe("");
    expect(parseColombianDate("ayer")).toBe("");
    expect(parseColombianDate("")).toBe("");
  });
});
