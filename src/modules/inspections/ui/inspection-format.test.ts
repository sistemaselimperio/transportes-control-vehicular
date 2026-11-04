import { describe, expect, it } from "vitest";
import { formatBogotaDate, formatBogotaDateTime, formatSignoff, formatInspectionDate, formatSheetDate, formatSheetTime } from "./inspection-format";

describe("formatInspectionDate", () => {
  it("writes dd/mm/yyyy", () => {
    expect(formatInspectionDate("2026-03-14")).toBe("14/03/2026");
  });
});

describe("paper sheet formats", () => {
  it("spaces the date like the printed boxes", () => {
    expect(formatSheetDate("2026-03-14")).toBe("14 / 03 / 2026");
  });

  it("spaces the time like the printed boxes", () => {
    expect(formatSheetTime("06:30")).toBe("06 : 30");
  });

  it("leaves a value it cannot split as it is", () => {
    expect(formatSheetDate("sin fecha")).toBe("sin fecha");
    expect(formatSheetTime("")).toBe("");
  });
});

describe("formatBogotaDateTime", () => {
  it("writes dd/mm/yyyy hh:mm in Colombia time", () => {
    expect(formatBogotaDateTime(new Date("2026-03-14T13:05:00Z"))).toBe("14/03/2026 08:05");
  });

  it("uses the Colombia calendar day across midnight UTC", () => {
    expect(formatBogotaDateTime(new Date("2026-03-15T03:30:00Z"))).toBe("14/03/2026 22:30");
  });
});

describe("formatSignoff", () => {
  const at = new Date("2026-03-14T13:05:00Z");

  it("joins the name and the Colombia date and time", () => {
    expect(formatSignoff("Rocío", at)).toBe("Rocío · 14/03/2026 08:05");
    expect(formatSignoff("Rocío", at, true)).toBe("Rocío · 14/03/2026");
    expect(formatBogotaDate(at)).toBe("14/03/2026");
  });

  it("drops what is missing", () => {
    expect(formatSignoff(null, at)).toBe("14/03/2026 08:05");
    expect(formatSignoff("Rocío", null)).toBe("Rocío");
  });
});
