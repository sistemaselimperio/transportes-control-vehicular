import { describe, expect, it } from "vitest";
import { mergeTimeline, type TimelineEntry } from "./vehicle-timeline";

const e = (p: Partial<TimelineEntry> & { title: string }): TimelineEntry => ({
  kind: "oil",
  date: null,
  detail: "",
  ...p,
});

describe("mergeTimeline", () => {
  it("orders entries from newest to oldest across kinds", () => {
    const out = mergeTimeline([
      e({ title: "owner", kind: "owner", date: "2020-01-10" }),
      e({ title: "oil", kind: "oil", date: "2026-03-01" }),
      e({ title: "doc", kind: "document", date: "2024-07-15" }),
    ]);
    expect(out.map((x) => x.title)).toEqual(["oil", "doc", "owner"]);
  });

  it("keeps the incoming order for entries on the same day", () => {
    const out = mergeTimeline([
      e({ title: "first", kind: "driver", date: "2025-05-05" }),
      e({ title: "second", kind: "owner", date: "2025-05-05" }),
      e({ title: "third", kind: "oil", date: "2025-05-05" }),
    ]);
    expect(out.map((x) => x.title)).toEqual(["first", "second", "third"]);
  });

  it("sends undated entries to the end, in their original order", () => {
    const out = mergeTimeline([
      e({ title: "u1", date: null }),
      e({ title: "dated", date: "2019-01-01" }),
      e({ title: "u2", date: null }),
    ]);
    expect(out.map((x) => x.title)).toEqual(["dated", "u1", "u2"]);
  });

  it("does not mutate its input", () => {
    const input = [e({ title: "a", date: "2020-01-01" }), e({ title: "b", date: "2021-01-01" })];
    const copy = [...input];
    mergeTimeline(input);
    expect(input).toEqual(copy);
  });
});
