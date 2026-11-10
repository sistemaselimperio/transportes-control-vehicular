import { describe, expect, it } from "vitest";
import {
  allowedNextStatuses,
  AUTO_DELIVER_AFTER_MS,
  canTransition,
  effectiveStatus,
  isTripStatus,
  TRIP_STATUSES,
  TRIP_STATUS_LABELS,
} from "./trip-status";

describe("TRIP_STATUSES", () => {
  it("lists the statuses in forward order", () => {
    expect(TRIP_STATUSES).toEqual(["programado", "entregado"]);
  });

  it("has a Spanish label for each", () => {
    expect(TRIP_STATUS_LABELS).toEqual({ programado: "Programado", entregado: "Entregado" });
  });
});

describe("isTripStatus", () => {
  it("accepts only known statuses", () => {
    expect(isTripStatus("entregado")).toBe(true);
    expect(isTripStatus("en_ruta")).toBe(false);
    expect(isTripStatus("")).toBe(false);
  });
});

describe("canTransition", () => {
  it("moves forward", () => {
    expect(canTransition("programado", "entregado")).toBe(true);
  });

  it("allows keeping the same status", () => {
    for (const s of TRIP_STATUSES) expect(canTransition(s, s)).toBe(true);
  });

  it("never goes backward", () => {
    expect(canTransition("entregado", "programado")).toBe(false);
  });
});

describe("allowedNextStatuses", () => {
  it("offers the current status and the later ones", () => {
    expect(allowedNextStatuses("programado")).toEqual(["programado", "entregado"]);
    expect(allowedNextStatuses("entregado")).toEqual(["entregado"]);
  });
});

describe("effectiveStatus", () => {
  const start = new Date("2026-03-10T08:00:00.000Z");
  const at = (ms: number) => new Date(start.getTime() + ms);

  it("auto-delivers after 12 hours", () => {
    expect(AUTO_DELIVER_AFTER_MS).toBe(12 * 60 * 60 * 1000);
  });

  it("is programado before the 12 hours pass", () => {
    expect(effectiveStatus("programado", start, at(AUTO_DELIVER_AFTER_MS - 1))).toBe("programado");
  });

  it("is entregado exactly at 12 hours", () => {
    expect(effectiveStatus("programado", start, at(AUTO_DELIVER_AFTER_MS))).toBe("entregado");
  });

  it("is entregado well after 12 hours", () => {
    expect(effectiveStatus("programado", start, at(5 * AUTO_DELIVER_AFTER_MS))).toBe("entregado");
  });

  it("keeps a future trip programado", () => {
    expect(effectiveStatus("programado", start, at(-24 * 60 * 60 * 1000))).toBe("programado");
  });

  it("keeps a manually delivered trip entregado, even before it starts", () => {
    expect(effectiveStatus("entregado", start, at(-1000))).toBe("entregado");
  });

  it("accepts an ISO string as the start", () => {
    expect(effectiveStatus("programado", start.toISOString(), at(AUTO_DELIVER_AFTER_MS))).toBe("entregado");
  });
});
