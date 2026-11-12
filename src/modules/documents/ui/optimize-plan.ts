/** Pure decisions behind the client-side file optimization (no DOM, testable). */

export const MAX_IMAGE_SIDE = 1800;
/** PDFs up to this size are uploaded untouched (digital PDFs are already small). */
export const PDF_REASONABLE_BYTES = 300 * 1024;

export type OptimizationPlan = "image" | "pdf" | "keep";

export function planOptimization(file: { mimeType: string; size: number }): OptimizationPlan {
  if (file.mimeType.startsWith("image/")) return "image";
  if (file.mimeType === "application/pdf" && file.size > PDF_REASONABLE_BYTES) return "pdf";
  return "keep";
}

/** Below this many text characters a page has no real text layer (only stray OCR marks or none). */
const TEXT_LAYER_MIN_CHARS = 40;

/**
 * A PDF is scanned when none of the sampled pages has a text layer. Digital PDFs (electronic
 * invoices) must not be rasterized: their text is what lets the AI read them reliably.
 */
export function isScannedPdf(textCharsPerPage: readonly number[]): boolean {
  return !textCharsPerPage.some((chars) => chars >= TEXT_LAYER_MIN_CHARS);
}

/** Scales (width, height) down so the longest side is at most `max`; never upscales. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
