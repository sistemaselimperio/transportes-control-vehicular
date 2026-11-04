import { describe, expect, it } from "vitest";
import { allowedNextStatuses, canTransition, isTripStatus, TRIP_STATUSES, TRIP_STATUS_LABELS } from "./trip-status";

describe("TRIP_STATUSES", () => {
  it("lists the statuses in forward order", () => {
    expect(TRIP_STATUSES).toEqual(["programado", "en_ruta", "entregado"]);
  });

  it("has a Spanish label for each", () => {
    expect(TRIP_STATUS_LABELS).toEqual({ programado: "Programado", en_ruta: "En ruta", entregado: "Entregado" });
  });
});

describe("isTripStatus", () => {
  it("accepts only known statuses", () => {
    expect(isTripStatus("en_ruta")).toBe(true);
    expect(isTripStatus("cancelado")).toBe(false);
    expect(isTripStatus("")).toBe(false);
  });
});

describe("canTransition", () => {
  it("moves forward one step", () => {
    expect(canTransition("programado", "en_ruta")).toBe(true);
    expect(canTransition("en_ruta", "entregado")).toBe(true);
  });

  it("allows skipping a step", () => {
    expect(canTransition("programado", "entregado")).toBe(true);
  });

  it("allows keeping the same status", () => {
    for (const s of TRIP_STATUSES) expect(canTransition(s, s)).toBe(true);
  });

  it("never goes backward", () => {
    expect(canTransition("en_ruta", "programado")).toBe(false);
    expect(canTransition("entregado", "en_ruta")).toBe(false);
    expect(canTransition("entregado", "programado")).toBe(false);
  });
});

describe("allowedNextStatuses", () => {
  it("offers the current status and the later ones", () => {
    expect(allowedNextStatuses("programado")).toEqual(["programado", "en_ruta", "entregado"]);
    expect(allowedNextStatuses("en_ruta")).toEqual(["en_ruta", "entregado"]);
    expect(allowedNextStatuses("entregado")).toEqual(["entregado"]);
  });
});
