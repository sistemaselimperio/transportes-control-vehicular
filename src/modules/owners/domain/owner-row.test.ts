import { describe, expect, it } from "vitest";
import {
  countOwnerViews,
  filterOwnerRows,
  filterOwnersByGroup,
  OWNER_VIEWS,
  parseViewParam,
  sortOwnerRows,
  type OwnerRow,
} from "./owner-row";

const row = (over: Partial<OwnerRow>): OwnerRow => ({
  id: 1,
  name: "A",
  documentNumber: null,
  group: "THIRD_PARTY",
  plates: [],
  ...over,
});

describe("parseViewParam", () => {
  it("reads 'con-vehiculos' as the owners holding vehicles", () => {
    expect(parseViewParam("con-vehiculos")).toBe("WITH_VEHICLES");
    expect(parseViewParam(["con-vehiculos", "x"])).toBe("WITH_VEHICLES");
  });

  it("falls back to the full list for anything else", () => {
    expect(parseViewParam(undefined)).toBe("ALL");
    expect(parseViewParam("todos")).toBe("ALL");
    expect(parseViewParam("otra")).toBe("ALL");
  });
});

describe("OWNER_VIEWS", () => {
  it("lists every owner first, then those with vehicles", () => {
    expect(OWNER_VIEWS.map((v) => v.key)).toEqual(["ALL", "WITH_VEHICLES"]);
  });
});

describe("filterOwnersByGroup", () => {
  const rows = [row({ id: 1, group: "IMPERIO" }), row({ id: 2, group: "PAEZ" })];

  it("keeps every owner when no group is selected", () => {
    expect(filterOwnersByGroup(rows, null).map((r) => r.id)).toEqual([1, 2]);
  });

  it("keeps only owners of the selected group", () => {
    expect(filterOwnersByGroup(rows, "PAEZ").map((r) => r.id)).toEqual([2]);
  });
});

describe("filterOwnerRows", () => {
  const rows = [
    row({ id: 1, name: "MUÑOZ PÉREZ", documentNumber: "1053350927", plates: ["ABC123"] }),
    row({ id: 2, name: "SANDRA PÁEZ", documentNumber: "74439231" }),
    row({ id: 3, name: "OTRO", documentNumber: null, plates: ["XYZ987"] }),
  ];

  it("hides owners without vehicles in the default view", () => {
    expect(filterOwnerRows(rows, { view: "WITH_VEHICLES", query: "" }).map((r) => r.id)).toEqual([1, 3]);
    expect(filterOwnerRows(rows, { view: "ALL", query: "" }).map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("searches the name ignoring accents and case", () => {
    expect(filterOwnerRows(rows, { view: "ALL", query: "munoz" }).map((r) => r.id)).toEqual([1]);
    expect(filterOwnerRows(rows, { view: "ALL", query: "paez" }).map((r) => r.id)).toEqual([2]);
  });

  it("searches the document ignoring dots and spaces", () => {
    expect(filterOwnerRows(rows, { view: "ALL", query: "1.053.350" }).map((r) => r.id)).toEqual([1]);
  });
});

describe("countOwnerViews", () => {
  it("counts both views and follows the search", () => {
    const rows = [row({ id: 1, name: "ANA", plates: ["ABC123"] }), row({ id: 2, name: "ANDRÉS" })];
    expect(countOwnerViews(rows, "")).toEqual({ WITH_VEHICLES: 1, ALL: 2 });
    expect(countOwnerViews(rows, "andr")).toEqual({ WITH_VEHICLES: 0, ALL: 1 });
  });
});

describe("sortOwnerRows", () => {
  it("orders by name ignoring accents and case", () => {
    const rows = [row({ id: 1, name: "Ñ" }), row({ id: 2, name: "muñoz" }), row({ id: 3, name: "ÁLVAREZ" })];
    expect(sortOwnerRows(rows).map((r) => r.id)).toEqual([3, 2, 1]);
  });
});
