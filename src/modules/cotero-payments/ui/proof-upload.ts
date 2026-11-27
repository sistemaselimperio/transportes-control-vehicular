import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/modules/documents/domain/vehicle-file-rules";
import { optimizeFile } from "@/modules/documents/ui/optimize-file";
import { prepareUploadsAction } from "../application/cotero-actions";

async function uploadToStorage(uploadUrl: string, file: File): Promise<boolean> {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const res = await fetch(uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false" } });
  return res.ok;
}

/** Shrinks the proof of payment and uploads it straight to storage; returns its storage path or the message to show. */
export async function uploadProof(proof: File): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!(ALLOWED_MIME as readonly string[]).includes(proof.type)) return { ok: false, error: "El comprobante debe ser PDF, JPG, PNG o WebP." };
  const stored = await optimizeFile(proof);
  if (stored.size > MAX_FILE_BYTES) return { ok: false, error: "El comprobante supera el límite de 4 MB." };
  const target = await prepareUploadsAction([{ kind: "proof", mimeType: stored.type, size: stored.size }]);
  if (!target.ok) return { ok: false, error: target.error };
  if (!(await uploadToStorage(target.uploads[0].uploadUrl, stored))) {
    return { ok: false, error: "No se pudo subir el comprobante. Intenta de nuevo." };
  }
  return { ok: true, path: target.uploads[0].path };
}
