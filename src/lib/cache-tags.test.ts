import { describe, expect, it } from "vitest";
import {
  CACHE_TAGS,
  changeTags,
  READ_DEPENDENCIES,
  readTags,
  vehicleFilesTag,
  type Change,
  type ReadName,
} from "./cache-tags";

const CHANGES: Change[] = [
  { kind: "vehicle" },
  { kind: "owner" },
  { kind: "driver" },
  { kind: "sale" },
  { kind: "logbook" },
  { kind: "logbook-with-oil" },
  { kind: "vehicle-file", plate: "ABC-123" },
];

describe("vehicleFilesTag", () => {
  it("is scoped to one plate", () => {
    expect(vehicleFilesTag("ABC-123")).toBe("vehicle-files:ABC-123");
    expect(vehicleFilesTag("ABC-123")).not.toBe(vehicleFilesTag("XYZ-987"));
  });
});

describe("readTags", () => {
  it("tags the fleet-derived reads with their own tag too", () => {
    expect(readTags("dashboard")).toContain(CACHE_TAGS.dashboard);
    expect(readTags("expiredCounts")).toContain(CACHE_TAGS.expiredCounts);
  });

  it("scopes the vehicle detail to its plate's files", () => {
    expect(readTags("vehicleDetail", "ABC-123")).toContain(vehicleFilesTag("ABC-123"));
    expect(readTags("vehicleDetail", "ABC-123")).not.toContain(vehicleFilesTag("XYZ-987"));
  });

  it("has no duplicates", () => {
    for (const read of Object.keys(READ_DEPENDENCIES) as ReadName[]) {
      const tags = readTags(read, "ABC-123");
      expect(new Set(tags).size).toBe(tags.length);
    }
  });
});

describe("changeTags", () => {
  it("a vehicle command expires the fleet, the lists it can create rows in, and the derived reads", () => {
    expect(changeTags({ kind: "vehicle" })).toEqual(
      expect.arrayContaining([
        CACHE_TAGS.fleet,
        CACHE_TAGS.owners,
        CACHE_TAGS.drivers,
        CACHE_TAGS.sales,
        CACHE_TAGS.dashboard,
        CACHE_TAGS.expiredCounts,
      ]),
    );
  });

  it("a driver edit leaves the dashboard and the nav counts alone", () => {
    const tags = changeTags({ kind: "driver" });
    expect(tags).toContain(CACHE_TAGS.drivers);
    expect(tags).not.toContain(CACHE_TAGS.dashboard);
    expect(tags).not.toContain(CACHE_TAGS.expiredCounts);
  });

  it("an owner edit changes the group counts of the dashboard and the nav", () => {
    const tags = changeTags({ kind: "owner" });
    expect(tags).toContain(CACHE_TAGS.owners);
    expect(tags).toContain(CACHE_TAGS.dashboard);
    expect(tags).toContain(CACHE_TAGS.expiredCounts);
  });

  it("a plain logbook write leaves the fleet alone", () => {
    expect(changeTags({ kind: "logbook" })).toEqual([CACHE_TAGS.logbook]);
  });

  it("logbook writes that touch oil changes also expire the fleet", () => {
    const tags = changeTags({ kind: "logbook-with-oil" });
    expect(tags).toEqual(
      expect.arrayContaining([CACHE_TAGS.logbook, CACHE_TAGS.fleet, CACHE_TAGS.dashboard, CACHE_TAGS.expiredCounts]),
    );
  });

  it("a file change only expires that plate's files", () => {
    expect(changeTags({ kind: "vehicle-file", plate: "ABC-123" })).toEqual([vehicleFilesTag("ABC-123")]);
  });

  it("has no duplicates", () => {
    for (const change of CHANGES) {
      const tags = changeTags(change);
      expect(new Set(tags).size).toBe(tags.length);
    }
  });
});

describe("read / change consistency", () => {
  // Which entity tags each change writes; a read must be expired by every change that writes
  // an entity it depends on, or it would serve stale rows.
  const WRITES: Record<Change["kind"], string[]> = {
    vehicle: [CACHE_TAGS.fleet, CACHE_TAGS.owners, CACHE_TAGS.drivers, CACHE_TAGS.sales],
    owner: [CACHE_TAGS.owners],
    driver: [CACHE_TAGS.drivers],
    sale: [CACHE_TAGS.sales],
    logbook: [CACHE_TAGS.logbook],
    "logbook-with-oil": [CACHE_TAGS.logbook, CACHE_TAGS.fleet],
    "vehicle-file": [],
  };

  it("every change expires every read that depends on what it writes", () => {
    for (const change of CHANGES) {
      const expired = new Set(changeTags(change));
      for (const read of Object.keys(READ_DEPENDENCIES) as ReadName[]) {
        const deps = readTags(read, "ABC-123");
        const touched = WRITES[change.kind].some((entity) => deps.includes(entity));
        if (touched) {
          expect(
            deps.some((tag) => expired.has(tag)),
            `${change.kind} must expire ${read}`,
          ).toBe(true);
        }
      }
    }
  });

  it("a file change expires the detail of its plate and nothing else", () => {
    const expired = new Set(changeTags({ kind: "vehicle-file", plate: "ABC-123" }));
    expect(readTags("vehicleDetail", "ABC-123").some((t) => expired.has(t))).toBe(true);
    expect(readTags("vehicleDetail", "XYZ-987").some((t) => expired.has(t))).toBe(false);
    expect(readTags("fleetRows").some((t) => expired.has(t))).toBe(false);
  });
});
