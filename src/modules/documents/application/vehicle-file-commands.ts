/**
 * Command use cases for the files of a vehicle. They validate with the pure
 * domain rules and delegate persistence to the `VehicleFileRepository` port.
 */
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { assertCanUpload, type FileCategory } from "../domain/vehicle-file-rules";
import type { VehicleFileContent, VehicleFileRepository } from "./vehicle-file-ports";

export interface UploadInput {
  category: FileCategory;
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export function createVehicleFileCommands(repo: VehicleFileRepository) {
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
      await repo.insert({ vehicleId, ...input });
      return { message: "Archivo subido." };
    },

    async deleteVehicleFile(plate: string, fileId: string): Promise<{ message: string }> {
      const vehicleId = await vehicleIdOf(plate);
      const file = await repo.findMeta(fileId);
      if (!file || file.vehicleId !== vehicleId) throw new RuleError("El archivo no existe.");
      await repo.remove(file.id);
      return { message: "Archivo eliminado." };
    },

    /** Content of a file, only when it belongs to that plate's vehicle. */
    async getVehicleFile(plate: string, fileId: string): Promise<VehicleFileContent | null> {
      const vehicleId = await repo.findVehicleId(plate);
      if (vehicleId == null) return null;
      const file = await repo.getContent(fileId);
      return file && file.vehicleId === vehicleId ? file : null;
    },
  };
}

export type VehicleFileCommands = ReturnType<typeof createVehicleFileCommands>;
