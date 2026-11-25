import { z } from "zod";
import { coteroRouteGuard, fileResponse } from "@/modules/cotero-payments/application/route-guard";
import { mimeOfPath } from "@/modules/cotero-payments/domain/receipt-files";
import { findReceiptFilePath } from "@/modules/cotero-payments/infrastructure/cotero-repository";
import { inlineContentDisposition } from "@/modules/documents/domain/content-disposition";
import { supabaseFileStorage } from "@/modules/documents/infrastructure/supabase-file-storage";

/** Streams the original file of a receipt inline. Only users with the cotero-payments flag can read it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await coteroRouteGuard();
  if (denied) return denied;

  const { id } = await params;
  const receiptId = z.coerce.number().int().positive().safeParse(id);
  if (!receiptId.success) return Response.json({ error: "Archivo no encontrado" }, { status: 404 });

  const path = await findReceiptFilePath(receiptId.data);
  const data = path ? await supabaseFileStorage.get(path) : null;
  if (!path || !data) return Response.json({ error: "Archivo no encontrado" }, { status: 404 });

  return fileResponse(data, mimeOfPath(path), {
    "Content-Disposition": inlineContentDisposition(`recibo-${receiptId.data}${path.slice(path.lastIndexOf("."))}`),
  });
}
