import { describe, expect, it } from "vitest";
import type { ClientLocationRow } from "./client-location";
import { filterClientList, filterClients, missingLocationCount, type ClientRow } from "./client-row";

const row = (over: Partial<ClientRow>): ClientRow => ({
  id: 1,
  name: "Agro Ñandú",
  nit: "9001234567",
  phone: null,
  notes: null,
  locations: [],
  deliveryCount: 0,
  ...over,
});

const rows = [row({ id: 1 }), row({ id: 2, name: "Lácteos Susa", nit: "800555111" }), row({ id: 3, name: "Sin Nit", nit: null })];

describe("filterClients", () => {
  it("finds by name, ignoring case and accents", () => {
    expect(filterClients(rows, "lacteos").map((r) => r.id)).toEqual([2]);
  });

  it("finds by NIT, with or without separators", () => {
    expect(filterClients(rows, "900.123").map((r) => r.id)).toEqual([1]);
    expect(filterClients(rows, "800555111").map((r) => r.id)).toEqual([2]);
  });

  it("returns every client for a blank query", () => {
    expect(filterClients(rows, " ")).toHaveLength(3);
  });
});

const place = (over: Partial<ClientLocationRow>): ClientLocationRow => ({
  id: 1,
  clientId: 1,
  name: "Finca",
  address: null,
  mapsUrl: null,
  latitude: null,
  longitude: null,
  ...over,
});

describe("missingLocationCount", () => {
  it("counts fincas with no address, link or coordinates", () => {
    const locations = [
      place({ id: 1 }),
      place({ id: 2, address: "Vereda El Alto" }),
      place({ id: 3, mapsUrl: "https://maps.app.goo.gl/x" }),
      place({ id: 4, latitude: 5.5, longitude: -73.3 }),
      place({ id: 5, address: "  " }),
    ];
    expect(missingLocationCount({ locations })).toBe(2);
  });

  it("is zero without fincas", () => {
    expect(missingLocationCount({ locations: [] })).toBe(0);
  });
});

describe("filterClientList", () => {
  const list = [
    row({ id: 1, locations: [place({ id: 1 })] }),
    row({ id: 2, name: "Lácteos Susa", locations: [place({ id: 2, address: "Km 3" })] }),
    row({ id: 3, name: "Agro Sur", locations: [] }),
  ];

  it("matches filterClients when the toggle is off", () => {
    expect(filterClientList(list, "", false).map((r) => r.id)).toEqual([1, 2, 3]);
    expect(filterClientList(list, "lacteos", false).map((r) => r.id)).toEqual([2]);
  });

  it("keeps only clients with a finca missing its location when on", () => {
    expect(filterClientList(list, "", true).map((r) => r.id)).toEqual([1]);
  });

  it("combines the search with the toggle", () => {
    expect(filterClientList(list, "lacteos", true)).toEqual([]);
    expect(filterClientList(list, "agro", true).map((r) => r.id)).toEqual([1]);
  });
});
