import { describe, expect, it } from "vitest";
import {
  countByYear,
  filterSales,
  filterSalesByGroup,
  formatPrice,
  parseYearParam,
  previousOwnerAtSale,
  resolveYear,
  saleYears,
  sortSaleRows,
  summarizeSales,
  type OwnershipPeriod,
  type SaleRow,
} from "./sale-row";

const sale = (over: Partial<SaleRow>): SaleRow => ({
  id: 1,
  plate: "AAA111",
  className: "Tractocamión",
  date: "2024-05-10",
  buyer: null,
  price: null,
  notes: null,
  previousOwner: null,
  previousOwnerGroup: null,
  ...over,
});

describe("parseYearParam", () => {
  it("reads a four-digit year or 'sin-fecha'", () => {
    expect(parseYearParam("2024")).toBe("2024");
    expect(parseYearParam(["2023", "x"])).toBe("2023");
    expect(parseYearParam("sin-fecha")).toBe("sin-fecha");
  });

  it("falls back to every sale", () => {
    expect(parseYearParam(undefined)).toBe("ALL");
    expect(parseYearParam("24")).toBe("ALL");
    expect(parseYearParam("abc")).toBe("ALL");
  });
});

describe("sortSaleRows", () => {
  it("puts the newest first and the undated last", () => {
    const rows = [
      sale({ id: 1, date: "2023-01-01" }),
      sale({ id: 2, date: null }),
      sale({ id: 3, date: "2024-06-01" }),
      sale({ id: 4, date: "2024-06-01" }),
    ];
    expect(sortSaleRows(rows).map((r) => r.id)).toEqual([4, 3, 1, 2]);
  });
});

describe("saleYears / resolveYear", () => {
  const rows = [
    sale({ date: "2023-01-01" }),
    sale({ date: "2024-06-01" }),
    sale({ date: "2024-07-01" }),
    sale({ date: null }),
  ];

  it("lists each year once, newest first", () => {
    expect(saleYears(rows)).toEqual(["2024", "2023"]);
  });

  it("falls back to every sale when the year has no sales", () => {
    expect(resolveYear("2024", rows)).toBe("2024");
    expect(resolveYear("1999", rows)).toBe("ALL");
    expect(resolveYear("sin-fecha", rows)).toBe("sin-fecha");
    expect(resolveYear("sin-fecha", [sale({})])).toBe("ALL");
  });
});

describe("filterSales", () => {
  const rows = [
    sale({ id: 1, plate: "ABC123", buyer: "José Muñoz", date: "2024-01-01" }),
    sale({ id: 2, plate: "XYZ987", buyer: null, date: "2023-01-01" }),
    sale({ id: 3, plate: "DEF456", buyer: "Ana", date: null }),
  ];

  it("filters by year and by no date", () => {
    expect(filterSales(rows, { year: "2024", query: "" }).map((r) => r.id)).toEqual([1]);
    expect(filterSales(rows, { year: "sin-fecha", query: "" }).map((r) => r.id)).toEqual([3]);
    expect(filterSales(rows, { year: "ALL", query: "" }).map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("searches plate and buyer ignoring case, accents and dashes", () => {
    expect(filterSales(rows, { year: "ALL", query: "abc-12" }).map((r) => r.id)).toEqual([1]);
    expect(filterSales(rows, { year: "ALL", query: "jose" }).map((r) => r.id)).toEqual([1]);
  });
});

describe("countByYear", () => {
  it("counts every filter key", () => {
    const rows = [sale({ date: "2024-01-01" }), sale({ date: "2024-02-01" }), sale({ date: null })];
    expect(countByYear(rows)).toEqual({ ALL: 3, "2024": 2, "sin-fecha": 1 });
  });
});

describe("filterSalesByGroup", () => {
  const rows = [sale({ id: 1, previousOwnerGroup: "IMPERIO" }), sale({ id: 2, previousOwnerGroup: null })];

  it("keeps sales whose previous owner is in the group", () => {
    expect(filterSalesByGroup(rows, null).map((r) => r.id)).toEqual([1, 2]);
    expect(filterSalesByGroup(rows, "IMPERIO").map((r) => r.id)).toEqual([1]);
  });
});

describe("summarizeSales", () => {
  it("adds the priced sales and counts the ones without price", () => {
    const rows = [sale({ price: 100 }), sale({ price: 50 }), sale({ price: null })];
    expect(summarizeSales(rows)).toEqual({ count: 3, total: 150, withoutPrice: 1 });
    expect(summarizeSales([])).toEqual({ count: 0, total: 0, withoutPrice: 0 });
  });
});

describe("formatPrice", () => {
  it("formats whole Colombian pesos", () => {
    expect(formatPrice(45_000_000).replace(/\s/g, " ")).toBe("$ 45.000.000");
  });
});

describe("previousOwnerAtSale", () => {
  const period = (over: Partial<OwnershipPeriod>): OwnershipPeriod => ({
    id: 1,
    ownerName: "A",
    group: "IMPERIO",
    fromDate: "2020-01-01",
    toDate: null,
    ...over,
  });

  it("picks the ownership that covers the sale date", () => {
    const periods = [
      period({ id: 1, ownerName: "PRIMERO", fromDate: "2019-01-01", toDate: "2022-01-01" }),
      period({ id: 2, ownerName: "SEGUNDO", fromDate: "2022-01-01", toDate: "2024-05-10" }),
    ];
    expect(previousOwnerAtSale("2023-03-01", periods)?.ownerName).toBe("SEGUNDO");
    expect(previousOwnerAtSale("2024-05-10", periods)?.ownerName).toBe("SEGUNDO");
  });

  it("falls back to the ownership closed latest when nothing covers the date", () => {
    const periods = [
      period({ id: 1, ownerName: "PRIMERO", fromDate: "2019-01-01", toDate: "2020-01-01" }),
      period({ id: 2, ownerName: "SEGUNDO", fromDate: "2020-01-01", toDate: "2021-01-01" }),
    ];
    expect(previousOwnerAtSale("2024-05-10", periods)?.ownerName).toBe("SEGUNDO");
    expect(previousOwnerAtSale(null, periods)?.ownerName).toBe("SEGUNDO");
  });

  it("returns null when the vehicle never had an owner", () => {
    expect(previousOwnerAtSale("2024-05-10", [])).toBeNull();
  });
});
