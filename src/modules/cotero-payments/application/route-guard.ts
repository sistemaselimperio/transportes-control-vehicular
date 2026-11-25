import { ForbiddenError } from "@/lib/permissions";
import { requireCoteroPayments } from "@/lib/session";

/** For route handlers: null when the session user has the cotero-payments flag, else the response to return. */
export async function coteroRouteGuard(): Promise<Response | null> {
  try {
    await requireCoteroPayments();
    return null;
  } catch (e) {
    if (e instanceof ForbiddenError) return Response.json({ error: "Sin acceso" }, { status: 403 });
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
}

/** The file answer shared by the receipt and proof routes: inline, private, never sniffed. */
export function fileResponse(data: Buffer, mimeType: string, headers: Record<string, string>): Response {
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(data.length),
      // Behind the session: never share or reuse it blindly.
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
