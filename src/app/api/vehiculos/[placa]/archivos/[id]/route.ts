import { z } from "zod";
import { requireSession } from "@/lib/session";
import { createVehicleFileCommands } from "@/modules/documents/application/vehicle-file-commands";
import { inlineContentDisposition } from "@/modules/documents/domain/content-disposition";
import { vehicleFileRepository } from "@/modules/documents/infrastructure/vehicle-file-repository";
import { normalizePlate } from "@/modules/vehicles/domain/plate";

const commands = createVehicleFileCommands(vehicleFileRepository);

/** Streams a vehicle's file inline. The proxy only checks the cookie, so the session is re-checked here. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ placa: string; id: string }> },
) {
  try {
    await requireSession();
  } catch {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { placa, id } = await params;
  let plate: string;
  try {
    plate = normalizePlate(decodeURIComponent(placa));
  } catch {
    return Response.json({ error: "Archivo no encontrado" }, { status: 404 });
  }
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  const file = await commands.getVehicleFile(plate, id);
  if (!file) return Response.json({ error: "Archivo no encontrado" }, { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.data.length),
      "Content-Disposition": inlineContentDisposition(file.fileName),
      // A file id is a random uuid that is only ever inserted or deleted, never overwritten, so the
      // bytes behind a URL never change. `private`: the route is behind the session.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
