import { extractReceiptDrafts } from "@/modules/cotero-payments/application/receipt-extractor";
import { coteroRouteGuard } from "@/modules/cotero-payments/application/route-guard";
import { CoteroError } from "@/modules/cotero-payments/domain/settlement-rules";
import { openAiReceiptExtractor } from "@/modules/cotero-payments/infrastructure/openai-receipt-extractor";

/** A page rendition is a JPEG of at most 1600 px; this is far above what that weighs. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * Reads the receipts on one page: the body is the page as a sharp JPEG (a rendition made in the browser
 * only for reading, not the stored file). Answers the drafts for the review screen; nothing is saved.
 */
export async function POST(request: Request) {
  const denied = await coteroRouteGuard();
  if (denied) return denied;

  const data = Buffer.from(await request.arrayBuffer());
  const isJpeg = data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (!isJpeg || data.length > MAX_IMAGE_BYTES) {
    return Response.json({ error: "La imagen de la hoja no es válida." }, { status: 400 });
  }

  try {
    const drafts = await extractReceiptDrafts(openAiReceiptExtractor, { mimeType: "image/jpeg", data });
    return Response.json({ drafts });
  } catch (e) {
    if (e instanceof CoteroError) return Response.json({ error: e.message }, { status: 502 });
    console.error("cotero read route failed", e);
    return Response.json({ error: "No se pudo leer la hoja." }, { status: 500 });
  }
}
