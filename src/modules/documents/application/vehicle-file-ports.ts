import type { FileCategory } from "../domain/vehicle-file-rules";

/** File metadata: everything except the bytes, so lists stay light. */
export interface VehicleFileMeta {
  id: string;
  vehicleId: number;
  category: FileCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
}

/** What the UI needs to list a file. */
export type VehicleFileItem = Pick<VehicleFileMeta, "id" | "category" | "fileName" | "sizeBytes" | "uploadedAt">;

export interface NewVehicleFile {
  vehicleId: number;
  category: FileCategory;
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export interface VehicleFileContent {
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export interface VehicleFileRepository {
  findVehicleId(plate: string): Promise<number | null>;
  countByCategory(vehicleId: number, category: FileCategory): Promise<number>;
  /** Metadata only: implementations must never load `data` here. */
  listByVehicle(vehicleId: number): Promise<VehicleFileMeta[]>;
  insert(file: NewVehicleFile): Promise<void>;
  findMeta(id: string): Promise<Pick<VehicleFileMeta, "id" | "vehicleId" | "fileName"> | null>;
  remove(id: string): Promise<void>;
  getContent(id: string): Promise<(VehicleFileContent & { vehicleId: number }) | null>;
}
