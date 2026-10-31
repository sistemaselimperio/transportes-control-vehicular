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

/** A new file row. The bytes already live in storage under `storagePath`. */
export interface NewVehicleFile {
  id: string;
  vehicleId: number;
  category: FileCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}

/** What the command returns: the row plus the bytes read from storage. */
export interface VehicleFileContent {
  fileName: string;
  mimeType: string;
  data: Buffer;
}

/** A stored row as the repository sees it; the bytes live in storage under `storagePath`. */
export interface StoredVehicleFile {
  fileName: string;
  mimeType: string;
  vehicleId: number;
  storagePath: string;
}

/** Object storage for the file bytes. Paths are `<vehicleId>/<fileId>`. */
export interface VehicleFileStorage {
  put(path: string, data: Buffer, mimeType: string): Promise<void>;
  /** The bytes, or null when the object does not exist. */
  get(path: string): Promise<Buffer | null>;
  remove(paths: string[]): Promise<void>;
}

export interface VehicleFileRepository {
  findVehicleId(plate: string): Promise<number | null>;
  countByCategory(vehicleId: number, category: FileCategory): Promise<number>;
  listByVehicle(vehicleId: number): Promise<VehicleFileMeta[]>;
  insert(file: NewVehicleFile): Promise<void>;
  findMeta(id: string): Promise<(Pick<VehicleFileMeta, "id" | "vehicleId" | "fileName"> & { storagePath: string }) | null>;
  remove(id: string): Promise<void>;
  getContent(id: string): Promise<StoredVehicleFile | null>;
}
