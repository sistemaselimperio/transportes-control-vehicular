import { z } from "zod";
import { coteroRouteGuard, fileResponse } from "@/modules/cotero-payments/application/route-guard";
import { mimeOfPath } from "@/modules/cotero-payments/domain/receipt-files";
import { findSettlementProofPath } from "@/modules/cotero-payments/infrastructure/cotero-repository";
import { inlineContentDisposition } from "@/modules/documents/domain/content-disposition";
import { supabaseFileStorage } from "@/modules/documents/infrastructure/supabase-file-storage";

/** Streams the proof of payment (comprobante) of a settlement inline. Only users with the flag can read it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await coteroRouteGuard();
  if (denied) return denied;

  const { id } = await params;
  const settlementId = z.coerce.number().int().positive().safeParse(id);
  if (!settlementId.success) return Response.json({ error: "Archivo no encontrado" }, { status: 404 });

  const path = await findSettlementProofPath(settlementId.data);
  const data = path ? await supabaseFileStorage.get(path) : null;
  if (!path || !data) return Response.json({ error: "Archivo no encontrado" }, { status: 404 });

  return fileResponse(data, mimeOfPath(path), {
    "Content-Disposition": inlineContentDisposition(`comprobante-${settlementId.data}${path.slice(path.lastIndexOf("."))}`),
  });
}
