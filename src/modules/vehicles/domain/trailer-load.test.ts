import { describe, expect, it } from "vitest";
import { KNOWN_OWNERS } from "@/modules/owners/domain/known-owners";
import { planTrailerLoad, TRAILERS_TO_LOAD, type TrailerSeed } from "./trailer-load";

const seed = (plate: string, ownerName: string | null, status: TrailerSeed["status"] = "ACTIVE"): TrailerSeed => ({
  plate,
  status,
  owner: ownerName ? { name: ownerName, group: "THIRD_PARTY" } : null,
});

describe("TRAILERS_TO_LOAD", () => {
  it("holds the 23 trailers with unique, already normalized plates", () => {
    expect(TRAILERS_TO_LOAD).toHaveLength(23);
    const plates = TRAILERS_TO_LOAD.map((t) => t.plate);
    expect(new Set(plates).size).toBe(23);
    expect(plates.every((p) => p === p.trim().toUpperCase())).toBe(true);
  });

  it("splits owners and blocked trailers as agreed", () => {
    const byOwner = (name: string) => TRAILERS_TO_LOAD.filter((t) => t.owner?.name === name).length;
    expect(byOwner(KNOWN_OWNERS.IMPERIO.name)).toBe(4);
    expect(byOwner(KNOWN_OWNERS.FABIAN.name)).toBe(12);
    expect(TRAILERS_TO_LOAD.filter((t) => t.owner?.group === "THIRD_PARTY")).toHaveLength(4);
    const blocked = TRAILERS_TO_LOAD.filter((t) => t.owner === null);
    expect(blocked.map((t) => [t.plate, t.status])).toEqual([
      ["R18876", "SOLD"],
      ["R18936", "IDLE"],
      ["R44914", "IDLE"],
    ]);
  });
});

describe("planTrailerLoad", () => {
  it("plans every trailer and its new owners on an empty database", () => {
    const plan = planTrailerLoad([seed("S1", "ACME"), seed("S2", "ACME"), seed("S3", null, "IDLE")], [], []);
    expect(plan.skippedPlates).toEqual([]);
    expect(plan.newOwners).toEqual([{ key: "ACME", name: "ACME", group: "THIRD_PARTY", documentNumber: null }]);
    expect(plan.trailers).toEqual([
      { plate: "S1", status: "ACTIVE", owner: { kind: "new", key: "ACME" } },
      { plate: "S2", status: "ACTIVE", owner: { kind: "new", key: "ACME" } },
      { plate: "S3", status: "IDLE", owner: null },
    ]);
  });

  it("skips plates that already exist, whatever their spelling", () => {
    const plan = planTrailerLoad([seed("S88490", "ACME"), seed("S2", null)], ["s 88490"], []);
    expect(plan.skippedPlates).toEqual(["S-88490"]);
    expect(plan.trailers.map((t) => t.plate)).toEqual(["S2"]);
    expect(plan.newOwners).toEqual([]);
  });

  it("reuses existing owners by name, ignoring case and accents", () => {
    const owners = [{ id: 4, name: "Fabián Páez", documentNumber: null }];
    const plan = planTrailerLoad([seed("S1", "FABIAN PAEZ")], [], owners);
    expect(plan.newOwners).toEqual([]);
    expect(plan.trailers[0].owner).toEqual({ kind: "existing", id: 4 });
  });

  it("reuses an existing owner by document number even when the name differs", () => {
    const owners = [
      { id: 9, name: "Transporte El Imperio S.A.S.", documentNumber: KNOWN_OWNERS.IMPERIO.documentNumber },
    ];
    const imperio: TrailerSeed = { plate: "S1", status: "ACTIVE", owner: { ...KNOWN_OWNERS.IMPERIO } };
    const plan = planTrailerLoad([imperio], [], owners);
    expect(plan.trailers[0].owner).toEqual({ kind: "existing", id: 9 });
    expect(plan.newOwners).toEqual([]);
  });

  it("creates a known owner with its document number and group once", () => {
    const imperio = (plate: string): TrailerSeed => ({
      plate,
      status: "ACTIVE",
      owner: { ...KNOWN_OWNERS.IMPERIO },
    });
    const plan = planTrailerLoad([imperio("S1"), imperio("S2")], [], []);
    expect(plan.newOwners).toEqual([
      {
        key: "TRANSPORTES EL IMPERIO",
        name: KNOWN_OWNERS.IMPERIO.name,
        group: "IMPERIO",
        documentNumber: KNOWN_OWNERS.IMPERIO.documentNumber,
      },
    ]);
  });

  it("is idempotent: planning again over what was loaded does nothing", () => {
    const first = planTrailerLoad(TRAILERS_TO_LOAD, [], []);
    const loadedOwners = first.newOwners.map((o, i) => ({
      id: i + 1,
      name: o.name,
      documentNumber: o.documentNumber,
    }));
    const second = planTrailerLoad(
      TRAILERS_TO_LOAD,
      first.trailers.map((t) => t.plate),
      loadedOwners,
    );
    expect(second.trailers).toEqual([]);
    expect(second.newOwners).toEqual([]);
    expect(second.skippedPlates).toHaveLength(23);
  });

  it("ignores a plate repeated inside the list", () => {
    const plan = planTrailerLoad([seed("S1", "ACME"), seed("s1", "OTHER")], [], []);
    expect(plan.trailers).toHaveLength(1);
    expect(plan.newOwners.map((o) => o.name)).toEqual(["ACME"]);
  });
});
