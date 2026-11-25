/**
 * Renditions of a file made in the browser only for the AI to read: every image, or every page of a PDF,
 * as a JPEG of at most 1600 px on its longest side at quality 0.85. They are sharper than the stored
 * file (which `optimizeFile` shrinks) and are never stored.
 */
import { fitWithin } from "@/modules/documents/ui/optimize-plan";

export const READING_MAX_SIDE = 1600;
export const READING_QUALITY = 0.85;
/** Pages read per PDF: a bigger one is a mistake, and each page is one AI call. */
export const MAX_PAGES_PER_FILE = 20;

export interface PageRendition {
  /** 1-based page of the file (1 for a photo). */
  page: number;
  blob: Blob;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", READING_QUALITY));
}

function newCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function renderImage(file: File): Promise<PageRendition[]> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, READING_MAX_SIDE);
  const canvas = newCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");
  // JPEG has no alpha: white first so a transparent PNG does not turn black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await canvasToJpeg(canvas);
  if (!blob) throw new Error("Could not encode the page");
  return [{ page: 1, blob }];
}

async function renderPdf(file: File): Promise<PageRendition[]> {
  // Loaded on demand: pdf.js is heavy.
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const source = await task.promise;
  try {
    if (source.numPages > MAX_PAGES_PER_FILE) {
      throw new Error(`El PDF tiene ${source.numPages} hojas; el máximo es ${MAX_PAGES_PER_FILE}.`);
    }
    const pages: PageRendition[] = [];
    for (let n = 1; n <= source.numPages; n++) {
      const page = await source.getPage(n);
      const base = page.getViewport({ scale: 1 });
      // A PDF page is 72 dpi (about 800 px): draw it up to the reading size so handwriting stays sharp.
      const viewport = page.getViewport({ scale: READING_MAX_SIDE / Math.max(base.width, base.height) });
      const canvas = newCanvas(Math.round(viewport.width), Math.round(viewport.height));
      await page.render({ canvas, viewport }).promise;
      const blob = await canvasToJpeg(canvas);
      page.cleanup();
      canvas.width = canvas.height = 0;
      if (!blob) throw new Error("Could not encode the page");
      pages.push({ page: n, blob });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

/** One rendition per page of the file; rejects with a readable message when it cannot be rendered. */
export function renderForReading(file: File): Promise<PageRendition[]> {
  return file.type === "application/pdf" ? renderPdf(file) : renderImage(file);
}
