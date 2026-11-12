import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, nextRotation, stepZoom, toggleZoom, zoomLabel } from "./viewer-zoom";

describe("stepZoom", () => {
  it("moves to the next preset level in each direction", () => {
    expect(stepZoom(1, "in")).toBe(1.5);
    expect(stepZoom(1.5, "out")).toBe(1);
    expect(stepZoom(1.2, "in")).toBe(1.5);
    expect(stepZoom(1.2, "out")).toBe(1);
  });

  it("stays within the limits", () => {
    expect(stepZoom(MAX_ZOOM, "in")).toBe(MAX_ZOOM);
    expect(stepZoom(MIN_ZOOM, "out")).toBe(MIN_ZOOM);
  });
});

describe("toggleZoom", () => {
  it("zooms a fitted image in, and any zoomed image back to fit", () => {
    expect(toggleZoom(1)).toBe(2);
    expect(toggleZoom(3)).toBe(1);
    expect(toggleZoom(0.5)).toBe(1);
  });
});

describe("nextRotation", () => {
  it("turns a quarter clockwise and wraps around", () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(270)).toBe(0);
  });
});

describe("zoomLabel", () => {
  it("shows the zoom as a percentage", () => {
    expect(zoomLabel(1)).toBe("100 %");
    expect(zoomLabel(1.5)).toBe("150 %");
  });
});
