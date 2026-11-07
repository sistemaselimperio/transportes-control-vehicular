import { describe, expect, it } from "vitest";
import {
  driverAtDate,
  LOGBOOK_SEARCH_MAX,
  logbookHref,
  logbookTabsFor,
  monthBounds,
  normalizePlateQuery,
  parseLogbookQuery,
  parseTabParam,
  summarizeCost,
  summarizeFuel,
} from "./logbook";

describe("parseTabParam", () => {
  it("reads the known tabs", () => {
    expect(parseTabParam("aceite")).toBe("aceite");
    expect(parseTabParam("llantas")).toBe("llantas");
    expect(parseTabParam("combustible")).toBe("combustible");
  });

  it("falls back to servicios for anything else", () => {
    expect(parseTabParam(undefined)).toBe("servicios");
    expect(parseTabParam("nope")).toBe("servicios");
    expect(parseTabParam(["aceite", "llantas"])).toBe("aceite");
  });
});

describe("logbookHref", () => {
  it("opens the Bitácora on one vehicle and tab, over its whole history", () => {
    expect(logbookHref("ABC-123", "combustible")).toBe("/bitacora?tab=combustible&placa=ABC-123");
  });

  it("round-trips through the page's own parsers", () => {
    const params = Object.fromEntries(new URLSearchParams(logbookHref("XYZ 98", "aceite").split("?")[1]));
    expect(parseTabParam(params.tab)).toBe("aceite");
    expect(parseLogbookQuery(params)).toEqual({
      ...NO_FILTERS,
      plate: "XYZ98",
    });
  });
});

describe("monthBounds", () => {
  it("covers the whole month", () => {
    expect(monthBounds("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("handles short and leap months", () => {
    expect(monthBounds("2026-02").to).toBe("2026-02-28");
    expect(monthBounds("2028-02").to).toBe("2028-02-29");
  });
});

describe("normalizePlateQuery", () => {
  it("ignores case, spaces and dashes", () => {
    expect(normalizePlateQuery(" abc-12 ")).toBe("ABC12");
  });

  it("drops characters that are special in a LIKE pattern", () => {
    expect(normalizePlateQuery("%_")).toBe("");
  });
});

const NO_FILTERS = { plate: "", from: null, to: null, group: null, search: "", kind: null, driverId: null, page: 1 };

describe("parseLogbookQuery", () => {
  it("reads placa, desde, hasta and grupo from the search params", () => {
    expect(parseLogbookQuery({ placa: "abc-1", desde: "2026-05-01", hasta: "2026-05-31", grupo: "PAEZ" })).toEqual({
      ...NO_FILTERS,
      plate: "ABC1",
      from: "2026-05-01",
      to: "2026-05-31",
      group: "PAEZ",
    });
  });

  it("defaults to no filters", () => {
    expect(parseLogbookQuery({})).toEqual(NO_FILTERS);
  });

  it("trims the search text and caps it at 80 characters", () => {
    expect(parseLogbookQuery({ q: "  cambio de frenos  " }).search).toBe("cambio de frenos");
    expect(parseLogbookQuery({ q: "x".repeat(200) }).search).toHaveLength(LOGBOOK_SEARCH_MAX);
    expect(LOGBOOK_SEARCH_MAX).toBe(80);
    expect(parseLogbookQuery({ q: ["a", "b"] }).search).toBe("a");
  });

  it("reads the service kind and drops unknown ones", () => {
    expect(parseLogbookQuery({ tipo: "PREVENTIVE" }).kind).toBe("PREVENTIVE");
    expect(parseLogbookQuery({ tipo: "CORRECTIVE" }).kind).toBe("CORRECTIVE");
    expect(parseLogbookQuery({ tipo: "preventive" }).kind).toBeNull();
    expect(parseLogbookQuery({ tipo: "x" }).kind).toBeNull();
  });

  it("reads the driver id and drops anything not a positive integer", () => {
    expect(parseLogbookQuery({ conductor: "12" }).driverId).toBe(12);
    expect(parseLogbookQuery({ conductor: "0" }).driverId).toBeNull();
    expect(parseLogbookQuery({ conductor: "-3" }).driverId).toBeNull();
    expect(parseLogbookQuery({ conductor: "1.5" }).driverId).toBeNull();
    expect(parseLogbookQuery({ conductor: "abc" }).driverId).toBeNull();
  });

  it("reads the page and falls back to 1 when invalid", () => {
    expect(parseLogbookQuery({ pagina: "3" }).page).toBe(3);
    expect(parseLogbookQuery({ pagina: "0" }).page).toBe(1);
    expect(parseLogbookQuery({ pagina: "-2" }).page).toBe(1);
    expect(parseLogbookQuery({ pagina: "x" }).page).toBe(1);
    expect(parseLogbookQuery({ pagina: "2.5" }).page).toBe(1);
    expect(parseLogbookQuery({}).page).toBe(1);
  });

  it("ignores dates that are malformed or do not exist", () => {
    expect(parseLogbookQuery({ desde: "2026-5-1", hasta: "2026-02-30" })).toMatchObject({ from: null, to: null });
  });

  it("swaps an inverted range", () => {
    expect(parseLogbookQuery({ desde: "2026-08-10", hasta: "2026-07-15" })).toMatchObject({
      from: "2026-07-15",
      to: "2026-08-10",
    });
  });

  it("keeps an open-ended range", () => {
    expect(parseLogbookQuery({ desde: "2026-07-15" })).toMatchObject({ from: "2026-07-15", to: null });
  });
});

describe("driverAtDate", () => {
  const periods = [
    { id: 1, driverName: "Ana", fromDate: "2026-01-01", toDate: "2026-03-10" },
    { id: 2, driverName: "Beto", fromDate: "2026-03-10", toDate: null },
  ];

  it("returns the driver whose period covers the date", () => {
    expect(driverAtDate("2026-02-01", periods)).toBe("Ana");
    expect(driverAtDate("2026-06-01", periods)).toBe("Beto");
  });

  it("prefers the newer assignment on the hand-over day", () => {
    expect(driverAtDate("2026-03-10", periods)).toBe("Beto");
  });

  it("is null before any assignment", () => {
    expect(driverAtDate("2025-12-31", periods)).toBeNull();
    expect(driverAtDate("2026-01-01", [])).toBeNull();
  });
});

describe("summarizeCost", () => {
  it("adds the known prices and counts the rest", () => {
    expect(summarizeCost([{ price: 1000 }, { price: null }, { price: 2500 }])).toEqual({
      count: 3,
      total: 3500,
      withoutPrice: 1,
    });
  });
});

describe("summarizeFuel", () => {
  it("adds gallons, urea and amounts without float noise", () => {
    expect(
      summarizeFuel([
        { gallons: 10.1, urea: 1.1, amount: 50000 },
        { gallons: 20.2, urea: 2.2, amount: 100000 },
      ]),
    ).toEqual({ count: 2, gallons: 30.3, urea: 3.3, amount: 150000 });
  });

  it("ignores missing gallons, urea and amounts in the sums", () => {
    expect(
      summarizeFuel([
        { gallons: 10, urea: null, amount: 50000 },
        { gallons: null, urea: 47.67, amount: null },
      ]),
    ).toEqual({ count: 2, gallons: 10, urea: 47.67, amount: 50000 });
  });
});

describe("logbookTabsFor", () => {
  it("gives a vehicle every logbook tab", () => {
    expect(logbookTabsFor({ isTrailer: false }).map((t) => t.key)).toEqual(["servicios", "aceite", "llantas", "combustible"]);
  });

  it("leaves oil and fuel out for a trailer: it has no engine and is never refueled", () => {
    expect(logbookTabsFor({ isTrailer: true }).map((t) => t.key)).toEqual(["servicios", "llantas"]);
  });
});
