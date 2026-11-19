import { describe, expect, it } from "vitest";
import { isTirePosition, positionLabel, TIRE_POSITIONS, TIRE_POSITION_CODES } from "./tire-positions";

describe("TIRE_POSITIONS", () => {
  it("has the 12 fixed positions of a trailer: 3 axles x 2 sides x inner/outer", () => {
    expect(TIRE_POSITIONS).toHaveLength(12);
    expect(new Set(TIRE_POSITION_CODES).size).toBe(12);
    expect(TIRE_POSITION_CODES).toContain("E1-I-EXT");
    expect(TIRE_POSITION_CODES).toContain("E3-D-INT");
  });

  it("covers every axle with four positions", () => {
    for (const axle of [1, 2, 3]) {
      expect(TIRE_POSITIONS.filter((p) => p.axle === axle)).toHaveLength(4);
    }
  });

  it("has no spare", () => {
    expect(TIRE_POSITION_CODES.some((c) => /rep|spare/i.test(c))).toBe(false);
  });
});

describe("isTirePosition", () => {
  it("accepts the known codes only", () => {
    expect(isTirePosition("E2-I-INT")).toBe(true);
    expect(isTirePosition("E4-I-INT")).toBe(false);
    expect(isTirePosition("E1-X-INT")).toBe(false);
    expect(isTirePosition("e1-i-int")).toBe(false);
    expect(isTirePosition("")).toBe(false);
  });
});

describe("positionLabel", () => {
  it("reads axle, side and slot in Spanish", () => {
    expect(positionLabel("E1-I-EXT")).toBe("Eje 1 · Izquierda · Exterior");
    expect(positionLabel("E3-D-INT")).toBe("Eje 3 · Derecha · Interior");
  });
});
