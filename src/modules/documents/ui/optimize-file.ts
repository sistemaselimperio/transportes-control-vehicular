/**
 * Shrinks a file in the browser before it is uploaded (the server caps files at 4 MB
 * and the database has little room). Best effort: any failure, or a result that is not
 * smaller, falls back to the original file. Which files get touched is decided by the
 * pure `planOptimization`; this module only does the canvas / pdf.js work.
 */
import { fitWithin, isScannedPdf, MAX_IMAGE_SIDE, planOptimization } from "./optimize-plan";

/** Pages read to decide whether a PDF is scanned; enough for a first invoice, cheap to extract. */
const TEXT_SAMPLE_PAGES = 3;

export type OptimizeOptions = {
  /** Keep digital PDFs (with a text layer) untouched; only scanned ones are rasterized. */
  keepDigitalPdf?: boolean;
};

const IMAGE_QUALITY = 0.75;
const PDF_PAGE_QUALITY = 0.6;
/** Rasterization density for scanned PDFs (PDF user space is 72 dpi). */
const PDF_DPI = 120;
const PDF_MAX_SIDE = 1600;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function newCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const withExtension = (name: string, ext: string) => `${name.replace(/\.[^./\\]+$/, "")}.${ext}`;

async function optimizeImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_SIDE);
  const canvas = newCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  // JPEG has no alpha: paint white first so transparent PNGs do not turn black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Browsers that cannot encode WebP silently return PNG; detect it and use JPEG instead.
  let blob = await canvasToBlob(canvas, "image/webp", IMAGE_QUALITY);
  if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", IMAGE_QUALITY);
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], withExtension(file.name, blob.type === "image/webp" ? "webp" : "jpg"), {
    type: blob.type,
  });
}

async function optimizePdf(file: File, options: OptimizeOptions): Promise<File> {
  // Loaded on demand: pdf.js is heavy and only large PDFs need it.
  const [pdfjs, { PDFDocument }] = await Promise.all([import("pdfjs-dist"), import("pdf-lib")]);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const source = await task.promise;
  try {
    if (options.keepDigitalPdf) {
      const chars: number[] = [];
      for (let n = 1; n <= Math.min(source.numPages, TEXT_SAMPLE_PAGES); n++) {
        const content = await (await source.getPage(n)).getTextContent();
        chars.push(content.items.reduce((sum, item) => sum + ("str" in item ? item.str.trim().length : 0), 0));
      }
      if (!isScannedPdf(chars)) return file;
    }
    const out = await PDFDocument.create();
    for (let n = 1; n <= source.numPages; n++) {
      const page = await source.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = PDF_DPI / 72;
      const { width, height } = fitWithin(base.width * scale, base.height * scale, PDF_MAX_SIDE);
      const viewport = page.getViewport({ scale: width / base.width });
      const canvas = newCanvas(Math.round(viewport.width), Math.round(viewport.height));
      await page.render({ canvas, viewport }).promise;
      const jpeg = await canvasToBlob(canvas, "image/jpeg", PDF_PAGE_QUALITY);
      if (!jpeg) return file;
      const image = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
      out.addPage([base.width, base.height]).drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
      page.cleanup();
      canvas.width = canvas.height = 0;
    }
    const bytes = await out.save();
    if (bytes.length >= file.size) return file;
    return new File([new Uint8Array(bytes)], file.name, { type: "application/pdf" });
  } finally {
    await task.destroy();
  }
}

/**
 * Keeps only the first `maxPages` pages of a PDF. Best effort: a non-PDF, a PDF that
 * already fits, or any failure returns the original file.
 */
export async function trimPdfPages(file: File, maxPages: number | null): Promise<File> {
  if (maxPages === null || file.type !== "application/pdf") return file;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    if (source.getPageCount() <= maxPages) return file;
    const out = await PDFDocument.create();
    const pages = await out.copyPages(source, Array.from({ length: maxPages }, (_, i) => i));
    pages.forEach((page) => out.addPage(page));
    const bytes = await out.save();
    return new File([new Uint8Array(bytes)], file.name, { type: "application/pdf" });
  } catch (e) {
    console.warn("pdf trimming failed, uploading the original", e);
    return file;
  }
}

export async function optimizeFile(file: File, options: OptimizeOptions = {}): Promise<File> {
  const plan = planOptimization({ mimeType: file.type, size: file.size });
  if (plan === "keep") return file;
  try {
    return plan === "image" ? await optimizeImage(file) : await optimizePdf(file, options);
  } catch (e) {
    console.warn("file optimization failed, uploading the original", e);
    return file;
  }
}
