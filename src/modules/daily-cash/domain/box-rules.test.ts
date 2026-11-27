import { describe, expect, it } from "vitest";
import { assertBoxOpen, canCloseBox, DailyCashError, isFirstBox, previousBox } from "./box-rules";

const boxes = [
  { id: 1, date: "2026-11-01", status: "closed" as const },
  { id: 2, date: "2026-11-02", status: "open" as const },
  { id: 3, date: "2026-11-04", status: "open" as const },
];

describe("previousBox", () => {
  it("is the box right before by date", () => {
    expect(previousBox(boxes, 3)?.id).toBe(2);
    expect(previousBox([...boxes].reverse(), 2)?.id).toBe(1);
  });

  it("is null for the earliest box", () => {
    expect(previousBox(boxes, 1)).toBeNull();
  });
});

describe("canCloseBox", () => {
  it("allows closing when the previous box is closed", () => {
    expect(canCloseBox(boxes, 2)).toBe(true);
  });

  it("allows closing the earliest box", () => {
    expect(canCloseBox(boxes, 1)).toBe(true);
  });

  it("refuses closing while the previous box is open", () => {
    expect(canCloseBox(boxes, 3)).toBe(false);
  });
});

describe("isFirstBox", () => {
  it("is true for a date before every other box, or with no others", () => {
    expect(isFirstBox([], "2026-11-10")).toBe(true);
    expect(isFirstBox(boxes, "2026-10-31")).toBe(true);
  });

  it("is false for a date after the earliest box", () => {
    expect(isFirstBox(boxes, "2026-11-03")).toBe(false);
  });
});

describe("assertBoxOpen", () => {
  it("passes for an open box", () => {
    expect(() => assertBoxOpen("open")).not.toThrow();
  });

  it("refuses a closed box with a message for the user", () => {
    expect(() => assertBoxOpen("closed")).toThrow(DailyCashError);
    expect(() => assertBoxOpen("closed")).toThrow(/cerrada/i);
  });
});
