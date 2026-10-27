import { describe, expect, it } from "vitest";
import {
  COLUMN_GROUPS,
  columnVisibility,
  parseHiddenGroups,
  serializeHiddenGroups,
  SORT_ONLY_COLUMNS,
  toggleGroup,
} from "./column-groups";

describe("COLUMN_GROUPS", () => {
  it("keeps all 14 grid columns, each in exactly one group", () => {
    const ids = COLUMN_GROUPS.flatMap((g) => g.columns);
    expect(ids).toHaveLength(14);
    expect(new Set(ids).size).toBe(14);
  });

  it("has no status column: the fleet views already split vehicles by status", () => {
    expect(COLUMN_GROUPS.flatMap((g) => g.columns)).not.toContain("status");
  });
});

describe("SORT_ONLY_COLUMNS", () => {
  it("keeps status sortable but always hidden", () => {
    expect(SORT_ONLY_COLUMNS).toContain("status");
    expect(columnVisibility(new Set()).status).toBe(false);
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
