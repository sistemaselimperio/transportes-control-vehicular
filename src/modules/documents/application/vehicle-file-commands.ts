/**
 * Command use cases for the files of a vehicle. They validate with the pure
 * domain rules and delegate persistence to the `VehicleFileRepository` port (rows) and
 * the `VehicleFileStorage` port (bytes).
 */
import { randomUUID } from "node:crypto";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { assertCanUpload, type FileCategory } from "../domain/vehicle-file-rules";
import type { VehicleFileContent, VehicleFileRepository, VehicleFileStorage } from "./vehicle-file-ports";

export interface UploadInput {
  category: FileCategory;
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export function createVehicleFileCommands(repo: VehicleFileRepository, storage: VehicleFileStorage) {
  async function vehicleIdOf(plate: string): Promise<number> {
    const id = await repo.findVehicleId(plate);
    if (id == null) throw new RuleError(`El vehículo ${plate} no existe.`);
    return id;
  }

  return {
    async uploadVehicleFile(plate: string, input: UploadInput): Promise<{ message: string }> {
      const vehicleId = await vehicleIdOf(plate);
      assertCanUpload({
        category: input.category,
        mimeType: input.mimeType,
        size: input.data.length,
        currentCount: await repo.countByCategory(vehicleId, input.category),
      });
      // Bytes first: a row must never point at an object that does not exist.
      const id = randomUUID();
      const storagePath = `${vehicleId}/${id}`;
      await storage.put(storagePath, input.data, input.mimeType);
      try {
        await repo.insert({
          id,
          vehicleId,
          category: input.category,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.data.length,
          storagePath,
        });
      } catch (e) {
        await storage.remove([storagePath]).catch((err) => console.error("vehicle file cleanup failed", err));
        throw e;
      }
      return { message: "Archivo subido." };
    },

    async deleteVehicleFile(plate: string, fileId: string): Promise<{ message: string }> {
      const vehicleId = await vehicleIdOf(plate);
      const file = await repo.findMeta(fileId);
      if (!file || file.vehicleId !== vehicleId) throw new RuleError("El archivo no existe.");
      await repo.remove(file.id);
      // The row is gone; a failed removal only leaves an orphan object, so it never fails the delete.
      await storage.remove([file.storagePath]).catch((err) => console.error("vehicle file removal failed", err));
      return { message: "Archivo eliminado." };
    },

    /** Content of a file, only when it belongs to that plate's vehicle. */
    async getVehicleFile(plate: string, fileId: string): Promise<VehicleFileContent | null> {
      const vehicleId = await repo.findVehicleId(plate);
      if (vehicleId == null) return null;
      const file = await repo.getContent(fileId);
      if (!file || file.vehicleId !== vehicleId) return null;
      const data = await storage.get(file.storagePath);
      return data ? { fileName: file.fileName, mimeType: file.mimeType, data } : null;
    },
  };
}

export type VehicleFileCommands = ReturnType<typeof createVehicleFileCommands>;
