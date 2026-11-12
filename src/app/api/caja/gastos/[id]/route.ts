import { z } from "zod";
import { ForbiddenError } from "@/lib/permissions";
import { requirePettyCash } from "@/lib/session";
import { inlineContentDisposition } from "@/modules/documents/domain/content-disposition";
import { supabaseFileStorage } from "@/modules/documents/infrastructure/supabase-file-storage";
import { findExpenseAttachment } from "@/modules/petty-cash/infrastructure/petty-cash-repository";

/** Streams the attachment of an expense inline. Only its owner (a petty-cash user) can read it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = (await requirePettyCash()).user.id;
  } catch (e) {
    if (e instanceof ForbiddenError) return Response.json({ error: "Sin acceso" }, { status: 403 });
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const expenseId = z.coerce.number().int().positive().safeParse(id);
  if (!expenseId.success) return Response.json({ error: "Archivo no encontrado" }, { status: 404 });

  const meta = await findExpenseAttachment(userId, expenseId.data);
  const data = meta ? await supabaseFileStorage.get(meta.path) : null;
  if (!meta || !data) return Response.json({ error: "Archivo no encontrado" }, { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": meta.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": inlineContentDisposition(meta.name),
      // Behind the session and replaceable by an edit: never share or reuse it blindly.
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
