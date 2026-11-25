/**
 * Where the files of the cotero payments live: the same bucket as the vehicle files, under their own
 * `recibos/` prefix. Receipts: `recibos/YYYY/MM/<uuid>.<ext>`; payment proofs: `recibos/comprobantes/YYYY/MM/<uuid>.<ext>`.
 */

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MIME_BY_EXTENSION: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RECEIPT_PATH = new RegExp(`^recibos/\\d{4}/\\d{2}/${UUID}\\.(pdf|jpg|png|webp)$`);
const PROOF_PATH = new RegExp(`^recibos/comprobantes/\\d{4}/\\d{2}/${UUID}\\.(pdf|jpg|png|webp)$`);

export const extensionOfMime = (mimeType: string): string | null => EXTENSIONS[mimeType] ?? null;

export function mimeOfPath(path: string): string {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

function datedPath(prefix: string, date: string, id: string, mimeType: string): string {
  const extension = extensionOfMime(mimeType);
  if (extension === null) throw new Error(`Unsupported mime type: ${mimeType}`);
  const [year, month] = date.split("-");
  return `${prefix}/${year}/${month}/${id}.${extension}`;
}

/** The storage path of a new receipt file; `date` is the upload day (ISO). */
export const receiptFilePath = (date: string, id: string, mimeType: string) => datedPath("recibos", date, id, mimeType);

/** The storage path of a new payment proof. */
export const proofFilePath = (date: string, id: string, mimeType: string) => datedPath("recibos/comprobantes", date, id, mimeType);

export const isReceiptFilePath = (path: string) => RECEIPT_PATH.test(path);
export const isProofPath = (path: string) => PROOF_PATH.test(path);
