/** Pure decisions behind the client-side file optimization (no DOM, testable). */

export const MAX_IMAGE_SIDE = 1800;
/** PDFs up to this size are uploaded untouched (digital PDFs are already small). */
export const PDF_REASONABLE_BYTES = 1024 * 1024;

export type OptimizationPlan = "image" | "pdf" | "keep";

export function planOptimization(file: { mimeType: string; size: number }): OptimizationPlan {
  if (file.mimeType.startsWith("image/")) return "image";
  if (file.mimeType === "application/pdf" && file.size > PDF_REASONABLE_BYTES) return "pdf";
  return "keep";
}

/** Scales (width, height) down so the longest side is at most `max`; never upscales. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
