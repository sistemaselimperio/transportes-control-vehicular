import { describe, expect, it } from "vitest";
import {
  assertCanAnchorTrailer,
  canAnchorTrailerStatus,
  isTrailerClass,
  TRAILER_CLASS_NAME,
} from "./trailer";
import { RuleError } from "./vehicle-rules";

const tractor = { plate: "TRC-500", isTrailer: false };
const trailer = { plate: "S88490", isTrailer: true, status: "ACTIVE" as const };

describe("isTrailerClass", () => {
  it("recognises the Remolque class regardless of case and accents", () => {
    expect(isTrailerClass(TRAILER_CLASS_NAME)).toBe(true);
    expect(isTrailerClass(" remolque ")).toBe(true);
    expect(isTrailerClass("Camión")).toBe(false);
  });
});

describe("canAnchorTrailerStatus", () => {
  it("blocks sold and idle trailers only", () => {
    expect(canAnchorTrailerStatus("ACTIVE")).toBe(true);
    expect(canAnchorTrailerStatus("IN_WORKSHOP")).toBe(true);
    expect(canAnchorTrailerStatus("IDLE")).toBe(false);
    expect(canAnchorTrailerStatus("SOLD")).toBe(false);
  });
});

describe("assertCanAnchorTrailer", () => {
  it("accepts an active or in-workshop trailer for a tractor", () => {
    expect(() => assertCanAnchorTrailer({ tractor, trailer })).not.toThrow();
    expect(() =>
      assertCanAnchorTrailer({ tractor, trailer: { ...trailer, status: "IN_WORKSHOP" } }),
    ).not.toThrow();
  });

  it("rejects a sold trailer", () => {
    expect(() => assertCanAnchorTrailer({ tractor, trailer: { ...trailer, status: "SOLD" } })).toThrow(
      new RuleError("El remolque S88490 está vendido y no se puede anclar."),
    );
  });

  it("rejects an idle trailer", () => {
    expect(() => assertCanAnchorTrailer({ tractor, trailer: { ...trailer, status: "IDLE" } })).toThrow(
      new RuleError("El remolque S88490 está inactivo y no se puede anclar."),
    );
  });

  it("rejects a vehicle that is not a trailer", () => {
    expect(() =>
      assertCanAnchorTrailer({ tractor, trailer: { ...trailer, plate: "ABC-123", isTrailer: false } }),
    ).toThrow(new RuleError("ABC-123 no es un remolque."));
  });

  it("rejects anchoring to another trailer", () => {
    expect(() =>
      assertCanAnchorTrailer({ tractor: { plate: "R31597", isTrailer: true }, trailer }),
    ).toThrow(new RuleError("Un remolque no puede llevar otro remolque."));
  });
});
