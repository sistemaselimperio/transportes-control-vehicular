import { z } from "zod";
import { auth } from "@/lib/auth";
import { buildVehiclesWorkbook } from "@/modules/import-export/infrastructure/xlsx-writer";
import { listVehicleRows } from "@/modules/vehicles/application/vehicle-queries";

const bodySchema = z.object({ plates: z.array(z.string()).max(5000) });

/** Exports the rows the operator is looking at (plates, in on-screen order). */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("No autorizado", { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Solicitud no válida", { status: 400 });

  const byPlate = new Map((await listVehicleRows()).map((r) => [r.plate, r]));
  const rows = parsed.data.plates.flatMap((p) => byPlate.get(p) ?? []);
  const data = await buildVehiclesWorkbook(rows);

  return new Response(data as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="vehiculos.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
