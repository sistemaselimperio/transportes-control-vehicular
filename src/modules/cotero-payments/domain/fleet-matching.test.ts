import { describe, expect, it } from "vitest";
import {
  applyFleetMatch,
  describeFleetIssue,
  levenshtein,
  matchDriver,
  matchPlate,
  matchReceiptFleet,
  nameKey,
  resolveFleetRefs,
  suggestDrivers,
  suggestPlates,
  toFleetCandidates,
  type FleetCandidates,
  type FleetDriver,
  type FleetVehicle,
} from "./fleet-matching";

const v = (id: number, plate: string, isTrailer = false): FleetVehicle => ({ id, plate, isTrailer });
const d = (id: number, name: string): FleetDriver => ({ id, name });

const FLEET: FleetCandidates = {
  vehicles: [v(1, "SWA-773"), v(2, "TXY-210"), v(3, "R-21396", true), v(4, "S-88490", true)],
  drivers: [d(1, "Oscar Andrés Sánchez Ruiz"), d(2, "Pedro Gómez"), d(3, "Juan Pérez")],
};
const tractors = FLEET.vehicles.filter((x) => !x.isTrailer);
const trailers = FLEET.vehicles.filter((x) => x.isTrailer);

describe("levenshtein", () => {
  it("counts single edits", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("SWA773", "SWA7T3")).toBe(1);
    expect(levenshtein("SWA773", "SWA77")).toBe(1);
  });
});

describe("nameKey", () => {
  it("ignores case, accents, punctuation and repeated spaces", () => {
    expect(nameKey("  ÓSCAR   andrés  Sánchez-Ruiz. ")).toBe("oscar andres sanchez ruiz");
    expect(nameKey("")).toBe("");
  });
});

describe("toFleetCandidates", () => {
  it("drops sold vehicles and inactive drivers, keeps idle and in-workshop ones", () => {
    const fleet = toFleetCandidates(
      [
        { id: 1, plate: "ABC-123", status: "ACTIVE", className: "Camión" },
        { id: 2, plate: "DEF-456", status: "IDLE", className: "Camión" },
        { id: 3, plate: "GHI-789", status: "IN_WORKSHOP", className: "Camión" },
        { id: 4, plate: "JKL-012", status: "SOLD", className: "Camión" },
        { id: 5, plate: "S-88490", status: "ACTIVE", className: "Remolque" },
        { id: 6, plate: "R-11111", status: "SOLD", className: "Remolque" },
      ],
      [
        { id: 1, name: "Pedro", status: "ACTIVE" },
        { id: 2, name: "Luis", status: "IN_WORKSHOP" },
        { id: 3, name: "Ana", status: "INACTIVE" },
      ],
    );
    expect(fleet.vehicles.map((x) => x.plate)).toEqual(["ABC-123", "DEF-456", "GHI-789", "S-88490"]);
    expect(fleet.vehicles.find((x) => x.plate === "S-88490")?.isTrailer).toBe(true);
    expect(fleet.vehicles.find((x) => x.plate === "ABC-123")?.isTrailer).toBe(false);
    expect(fleet.drivers.map((x) => x.name)).toEqual(["Luis", "Pedro"]);
  });
});

describe("matchPlate", () => {
  it("is empty for blank text", () => {
    expect(matchPlate("  ", tractors)).toEqual({ status: "empty" });
  });

  it("matches ignoring hyphens, spaces and case", () => {
    expect(matchPlate("swa 773", tractors)).toEqual({ status: "exact", item: tractors[0] });
    expect(matchPlate("SWA773", tractors)).toEqual({ status: "exact", item: tractors[0] });
    expect(matchPlate("r21396", trailers)).toEqual({ status: "exact", item: trailers[0] });
  });

  it("corrects a plate that is one edit away from exactly one candidate", () => {
    expect(matchPlate("SWA7T3", tractors)).toEqual({ status: "corrected", item: tractors[0], original: "SWA7T3" });
    expect(matchPlate("SWA-77", tractors)).toMatchObject({ status: "corrected", item: tractors[0] });
    expect(matchPlate("R2I396", trailers)).toMatchObject({ status: "corrected", item: trailers[0] });
  });

  it("does not correct when two candidates are one edit away, it suggests both", () => {
    const close = [v(1, "ABC-123"), v(2, "ABC-124")];
    const result = matchPlate("ABC-125", close);
    expect(result.status).toBe("unmatched");
    if (result.status === "unmatched") expect(result.suggestions.map((s) => s.plate)).toEqual(["ABC-123", "ABC-124"]);
  });

  it("does not correct at two edits but still suggests the closest first", () => {
    const result = matchPlate("SWA-7XX", tractors);
    expect(result.status).toBe("unmatched");
    if (result.status === "unmatched") expect(result.suggestions[0]).toEqual(tractors[0]);
  });

  it("ignores candidates farther than three edits", () => {
    const result = matchPlate("ZZZ-999", tractors);
    expect(result).toEqual({ status: "unmatched", suggestions: [] });
  });

  it("never offers a trailer as a tractor or the other way round", () => {
    expect(matchPlate("R-21396", tractors).status).toBe("unmatched");
    expect(matchPlate("SWA-773", trailers).status).toBe("unmatched");
  });

  it("caps the suggestions at five", () => {
    const many = Array.from({ length: 9 }, (_, i) => v(i + 1, `AAA-10${i}`));
    const result = matchPlate("AAA-999", many);
    if (result.status === "unmatched") expect(result.suggestions.length).toBeLessThanOrEqual(5);
  });
});

describe("suggestPlates", () => {
  it("lists the first candidates for an empty query", () => {
    expect(suggestPlates("", tractors).map((s) => s.plate)).toEqual(["SWA-773", "TXY-210"]);
  });

  it("finds partial plates while typing", () => {
    expect(suggestPlates("77", tractors).map((s) => s.plate)).toEqual(["SWA-773"]);
    expect(suggestPlates("txy", tractors).map((s) => s.plate)).toEqual(["TXY-210"]);
  });

  it("falls back to similar plates", () => {
    expect(suggestPlates("SWA7T3", tractors).map((s) => s.plate)).toEqual(["SWA-773"]);
  });
});

describe("matchDriver", () => {
  it("is empty for blank text", () => {
    expect(matchDriver("", FLEET.drivers)).toEqual({ status: "empty" });
  });

  it("matches the same name silently regardless of case, accents and spacing", () => {
    expect(matchDriver("pedro  gomez", FLEET.drivers)).toEqual({ status: "exact", item: FLEET.drivers[1] });
    expect(matchDriver("JUAN PEREZ", FLEET.drivers)).toEqual({ status: "exact", item: FLEET.drivers[2] });
  });

  it("corrects a name that is very similar to a single driver", () => {
    expect(matchDriver("Pedro Gomes", FLEET.drivers)).toEqual({ status: "corrected", item: FLEET.drivers[1], original: "Pedro Gomes" });
    expect(matchDriver("Juan Peres", FLEET.drivers)).toMatchObject({ status: "corrected", item: FLEET.drivers[2] });
  });

  it("does not correct when two drivers are equally similar", () => {
    const twins = [d(1, "Carlos Ramirez"), d(2, "Carlos Ramires")];
    const result = matchDriver("Carlos Ramiret", twins);
    expect(result.status).toBe("unmatched");
    if (result.status === "unmatched") expect(result.suggestions).toHaveLength(2);
  });

  it("does not correct a short name with an edit that is too big", () => {
    const result = matchDriver("Pepe", [d(1, "Pedro")]);
    expect(result.status).toBe("unmatched");
  });

  it("suggests, without correcting, a name that is a subset of a longer one", () => {
    const result = matchDriver("Oscar Sanchez", FLEET.drivers);
    expect(result.status).toBe("unmatched");
    if (result.status === "unmatched") expect(result.suggestions[0]).toEqual(FLEET.drivers[0]);
  });

  it("suggests nothing for an unrelated name", () => {
    expect(matchDriver("Zoila Quintero", FLEET.drivers)).toEqual({ status: "unmatched", suggestions: [] });
  });
});

describe("suggestDrivers", () => {
  it("finds drivers by a name prefix, ignoring accents", () => {
    expect(suggestDrivers("osc", FLEET.drivers).map((s) => s.name)).toEqual(["Oscar Andrés Sánchez Ruiz"]);
    expect(suggestDrivers("gome", FLEET.drivers).map((s) => s.name)).toEqual(["Pedro Gómez"]);
  });

  it("lists drivers for an empty query", () => {
    expect(suggestDrivers("", FLEET.drivers)).toHaveLength(3);
  });
});

describe("matchReceiptFleet and applyFleetMatch", () => {
  const base = { vehiclePlate: "SWA7T3", trailerPlate: "R-21396", driverName: "Pedro Gomes" };

  it("corrects every field and reports the original text read", () => {
    const match = matchReceiptFleet(base, FLEET);
    const { draft, corrected } = applyFleetMatch({ ...base, destination: "x" }, match);
    expect(draft).toEqual({ vehiclePlate: "SWA-773", trailerPlate: "R-21396", driverName: "Pedro Gómez", destination: "x" });
    expect(corrected).toEqual({ vehiclePlate: "SWA7T3", driverName: "Pedro Gomes" });
  });

  it("writes the app's own form of an exact match without flagging it", () => {
    const { draft, corrected } = applyFleetMatch(
      { vehiclePlate: "swa773", trailerPlate: "", driverName: "pedro gomez" },
      matchReceiptFleet({ vehiclePlate: "swa773", trailerPlate: "", driverName: "pedro gomez" }, FLEET),
    );
    expect(draft).toEqual({ vehiclePlate: "SWA-773", trailerPlate: "", driverName: "Pedro Gómez" });
    expect(corrected).toEqual({});
  });

  it("leaves unmatched text as it was read", () => {
    const input = { vehiclePlate: "ZZZ-999", trailerPlate: "Q-00000", driverName: "Zoila Quintero" };
    const { draft, corrected } = applyFleetMatch(input, matchReceiptFleet(input, FLEET));
    expect(draft).toEqual(input);
    expect(corrected).toEqual({});
  });
});

describe("resolveFleetRefs", () => {
  it("resolves ids and the snapshot of exact matches", () => {
    const result = resolveFleetRefs({ vehiclePlate: "SWA773", trailerPlate: "R21396", driverName: "pedro gomez" }, FLEET);
    expect(result).toEqual({
      ok: true,
      refs: { vehicleId: 1, trailerId: 3, driverId: 2, vehiclePlate: "SWA773", trailerPlate: "R21396", driverName: "Pedro Gómez" },
    });
  });

  it("allows an empty trailer", () => {
    const result = resolveFleetRefs({ vehiclePlate: "SWA-773", trailerPlate: "", driverName: "Juan Pérez" }, FLEET);
    expect(result).toMatchObject({ ok: true, refs: { trailerId: null, trailerPlate: null } });
  });

  it("never auto-corrects: a near miss is refused", () => {
    const result = resolveFleetRefs({ vehiclePlate: "SWA7T3", trailerPlate: "", driverName: "Pedro Gomes" }, FLEET);
    expect(result).toEqual({
      ok: false,
      issues: [
        { field: "vehiclePlate", kind: "not-in-fleet", value: "SWA7T3" },
        { field: "driverName", kind: "not-in-fleet", value: "Pedro Gomes" },
      ],
    });
  });

  it("refuses a trailer used as the vehicle and a vehicle used as the trailer", () => {
    const result = resolveFleetRefs({ vehiclePlate: "R-21396", trailerPlate: "SWA-773", driverName: "Juan Pérez" }, FLEET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.field)).toEqual(["vehiclePlate", "trailerPlate"]);
  });

  it("requires the vehicle and the driver", () => {
    const result = resolveFleetRefs({ vehiclePlate: "", trailerPlate: "", driverName: " " }, FLEET);
    expect(result).toEqual({
      ok: false,
      issues: [
        { field: "vehiclePlate", kind: "missing", value: "" },
        { field: "driverName", kind: "missing", value: "" },
      ],
    });
  });
});

describe("describeFleetIssue", () => {
  it("says what is wrong in Spanish", () => {
    expect(describeFleetIssue({ field: "vehiclePlate", kind: "not-in-fleet", value: "SWA7T3" })).toMatch(/placa SWA7T3.*flota/);
    expect(describeFleetIssue({ field: "trailerPlate", kind: "not-in-fleet", value: "r21396" })).toMatch(/trailer R-21396.*flota/);
    expect(describeFleetIssue({ field: "driverName", kind: "not-in-fleet", value: "Zoila" })).toMatch(/conductor Zoila.*conductores/);
    expect(describeFleetIssue({ field: "driverName", kind: "missing", value: "" })).toMatch(/falta.*conductor/i);
  });
});
