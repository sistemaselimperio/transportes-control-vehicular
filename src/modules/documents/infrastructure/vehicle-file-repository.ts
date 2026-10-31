import { and, asc, count, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { VehicleFileRepository } from "../application/vehicle-file-ports";

const { vehicleFiles } = schema;

/** Columns of a file without its bytes: list queries must never select `data`. */
const metaColumns = {
  id: vehicleFiles.id,
  vehicleId: vehicleFiles.vehicleId,
  category: vehicleFiles.category,
  fileName: vehicleFiles.fileName,
  mimeType: vehicleFiles.mimeType,
  sizeBytes: vehicleFiles.sizeBytes,
  uploadedAt: vehicleFiles.uploadedAt,
};

export const vehicleFileRepository: VehicleFileRepository = {
  async findVehicleId(plate) {
    const [row] = await db
      .select({ id: schema.vehicles.id })
      .from(schema.vehicles)
      .where(eq(schema.vehicles.plate, plate));
    return row?.id ?? null;
  },

  async countByCategory(vehicleId, category) {
    const [row] = await db
      .select({ n: count() })
      .from(vehicleFiles)
      .where(and(eq(vehicleFiles.vehicleId, vehicleId), eq(vehicleFiles.category, category)));
    return row?.n ?? 0;
  },

  listByVehicle(vehicleId) {
    return db
      .select(metaColumns)
      .from(vehicleFiles)
      .where(eq(vehicleFiles.vehicleId, vehicleId))
      .orderBy(asc(vehicleFiles.uploadedAt));
  },

  async insert(file) {
    await db.insert(vehicleFiles).values({
      id: file.id,
      vehicleId: file.vehicleId,
      category: file.category,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      storagePath: file.storagePath,
    });
  },

  async findMeta(id) {
    const [row] = await db
      .select({
        id: vehicleFiles.id,
        vehicleId: vehicleFiles.vehicleId,
        fileName: vehicleFiles.fileName,
        storagePath: vehicleFiles.storagePath,
      })
      .from(vehicleFiles)
      .where(eq(vehicleFiles.id, id));
    return row ?? null;
  },

  async remove(id) {
    await db.delete(vehicleFiles).where(eq(vehicleFiles.id, id));
  },

  async getContent(id) {
    const [row] = await db
      .select({
        vehicleId: vehicleFiles.vehicleId,
        fileName: vehicleFiles.fileName,
        mimeType: vehicleFiles.mimeType,
        storagePath: vehicleFiles.storagePath,
        data: vehicleFiles.data,
      })
      .from(vehicleFiles)
      .where(eq(vehicleFiles.id, id));
    return row ?? null;
  },
};

/** Storage paths of every stored file, so a bulk vehicle delete can clean the objects up afterwards. */
export async function listAllStoragePaths(): Promise<string[]> {
  const rows = await db
    .select({ path: vehicleFiles.storagePath })
    .from(vehicleFiles)
    .where(isNotNull(vehicleFiles.storagePath));
  return rows.flatMap((r) => (r.path ? [r.path] : []));
}
