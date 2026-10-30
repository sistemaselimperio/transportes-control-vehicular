import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES } from "../domain/vehicle-file-rules";
import { fitWithin, planOptimization } from "./optimize-plan";

const KB = 1024;
const MB = 1024 * KB;

describe("planOptimization", () => {
  it("compresses images", () => {
    expect(planOptimization({ mimeType: "image/jpeg", size: 3 * MB })).toBe("image");
    expect(planOptimization({ mimeType: "image/png", size: 100 })).toBe("image");
    expect(planOptimization({ mimeType: "image/webp", size: 100 })).toBe("image");
  });

  it("leaves PDFs of 300 KB or less untouched", () => {
    expect(planOptimization({ mimeType: "application/pdf", size: 300 * KB })).toBe("keep");
    expect(planOptimization({ mimeType: "application/pdf", size: 10 })).toBe("keep");
  });

  it("rasterizes PDFs above 300 KB", () => {
    expect(planOptimization({ mimeType: "application/pdf", size: 300 * KB + 1 })).toBe("pdf");
    expect(planOptimization({ mimeType: "application/pdf", size: 2 * MB })).toBe("pdf");
  });

  it("keeps anything else as is", () => {
    expect(planOptimization({ mimeType: "application/msword", size: 5 * MB })).toBe("keep");
  });
});

describe("fitWithin", () => {
  it("does not upscale small images", () => {
    expect(fitWithin(800, 600, 1800)).toEqual({ width: 800, height: 600 });
  });

  it("scales the longest side down to the max, keeping the ratio", () => {
    expect(fitWithin(3600, 1800, 1800)).toEqual({ width: 1800, height: 900 });
    expect(fitWithin(1000, 4000, 1800)).toEqual({ width: 450, height: 1800 });
  });
});

describe("limits", () => {
  it("the server limit is above the optimization threshold", () => {
    expect(MAX_FILE_BYTES).toBeGreaterThan(MB);
  });
});
