import { describe, expect, it } from "vitest";
import { isTripArea, TRIP_AREAS } from "./trip-areas";

describe("TRIP_AREAS", () => {
  it("is the fixed list of areas", () => {
    expect(TRIP_AREAS).toEqual([
      "Traslados",
      "Cemento",
      "Ganadería",
      "Ruta Ricaurte",
      "Abono",
      "Concentrado",
      "Combustible",
      "Trasolicar",
    ]);
  });
});

describe("isTripArea", () => {
  it("matches exactly", () => {
    expect(isTripArea("Cemento")).toBe(true);
    expect(isTripArea("cemento")).toBe(false);
    expect(isTripArea("Otra")).toBe(false);
  });
});
