import { describe, expect, it } from "vitest";
import {
  COLUMN_GROUPS,
  columnVisibility,
  parseHiddenGroups,
  serializeHiddenGroups,
  toggleGroup,
} from "./column-groups";

describe("COLUMN_GROUPS", () => {
  it("keeps all 15 grid columns, each in exactly one group", () => {
    const ids = COLUMN_GROUPS.flatMap((g) => g.columns);
    expect(ids).toHaveLength(15);
    expect(new Set(ids).size).toBe(15);
  });
});

describe("parseHiddenGroups", () => {
  it("reads a comma separated list and ignores unknown or pinned groups", () => {
    expect([...parseHiddenGroups("people,documents")]).toEqual(["people", "documents"]);
    expect([...parseHiddenGroups("people,nope,vehicle")]).toEqual(["people"]);
  });

  it("treats a missing or empty value as nothing hidden", () => {
    expect(parseHiddenGroups(null).size).toBe(0);
    expect(parseHiddenGroups("").size).toBe(0);
  });
});

describe("toggleGroup / serializeHiddenGroups", () => {
  it("hides and shows a group without touching the others", () => {
    const hidden = toggleGroup(new Set(), "documents");
    expect(serializeHiddenGroups(hidden)).toBe("documents");
    const more = toggleGroup(hidden, "people");
    expect(serializeHiddenGroups(more)).toBe("people,documents");
    expect(serializeHiddenGroups(toggleGroup(more, "documents"))).toBe("people");
  });

  it("never hides the pinned vehicle group", () => {
    expect(toggleGroup(new Set(), "vehicle").size).toBe(0);
  });
});

describe("columnVisibility", () => {
  it("marks every column of a hidden group as not visible", () => {
    const v = columnVisibility(new Set(["maintenance"] as const));
    expect(v.km).toBe(false);
    expect(v.lastOil).toBe(false);
    expect(v.nextChange).toBe(false);
    expect(v.plate).toBe(true);
    expect(v.soat).toBe(true);
  });
});
