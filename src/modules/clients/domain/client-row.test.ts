import { describe, expect, it } from "vitest";
import { filterClients, type ClientRow } from "./client-row";

const row = (over: Partial<ClientRow>): ClientRow => ({
  id: 1,
  name: "Agro Ñandú",
  nit: "9001234567",
  phone: null,
  address: null,
  mapsUrl: null,
  latitude: null,
  longitude: null,
  notes: null,
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
