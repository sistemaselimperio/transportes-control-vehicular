import { describe, expect, it, vi } from "vitest";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { MAX_FILE_BYTES, type FileCategory } from "../domain/vehicle-file-rules";
import { createVehicleFileCommands } from "./vehicle-file-commands";
import type { NewVehicleFile, VehicleFileRepository, VehicleFileStorage } from "./vehicle-file-ports";

const PLATES: Record<string, number> = { "AAA-111": 1, "BBB-222": 2 };

/** In-memory fake that keeps file rows in a map. */
function fakeRepo() {
  const files = new Map<string, NewVehicleFile>();
  const repo: VehicleFileRepository = {
    findVehicleId: async (plate) => PLATES[plate] ?? null,
    countByCategory: async (vehicleId, category: FileCategory) =>
      [...files.values()].filter((f) => f.vehicleId === vehicleId && f.category === category).length,
    listByVehicle: async () => [],
    insert: async (file) => void files.set(file.id, file),
    findMeta: async (id) => {
      const f = files.get(id);
      return f ? { id, vehicleId: f.vehicleId, fileName: f.fileName, storagePath: f.storagePath } : null;
    },
    remove: async (id) => void files.delete(id),
    getContent: async (id) => {
      const f = files.get(id);
      return f ? { vehicleId: f.vehicleId, fileName: f.fileName, mimeType: f.mimeType, storagePath: f.storagePath } : null;
    },
  };
  return { repo, files };
}

/** In-memory object storage. */
function fakeStorage() {
  const objects = new Map<string, Buffer>();
  const storage: VehicleFileStorage = {
    put: async (path, data) => void objects.set(path, data),
    get: async (path) => objects.get(path) ?? null,
    remove: async (paths) => paths.forEach((p) => objects.delete(p)),
  };
  return { storage, objects };
}

function setup() {
  const { repo, files } = fakeRepo();
  const { storage, objects } = fakeStorage();
  return { repo, files, storage, objects, cmds: createVehicleFileCommands(repo, storage) };
}

/** The id of the only stored row. */
const onlyId = (files: Map<string, unknown>) => [...files.keys()][0];

const pdf = (overrides = {}) => ({
  category: "SOAT" as FileCategory,
  fileName: "soat.pdf",
  mimeType: "application/pdf",
  data: Buffer.from("%PDF-1.4"),
  ...overrides,
});

describe("uploadVehicleFile", () => {
  it("stores the bytes in storage and the row with its path and size", async () => {
    const { cmds, files, objects } = setup();
    const result = await cmds.uploadVehicleFile("AAA-111", pdf());
    expect(result.message).toMatch(/subido/i);
    expect(files.size).toBe(1);
    const row = [...files.values()][0];
    expect(row).toMatchObject({ vehicleId: 1, category: "SOAT", fileName: "soat.pdf", sizeBytes: 8 });
    expect(row.storagePath).toBe(`1/${row.id}`);
    expect(objects.get(row.storagePath)?.toString()).toBe("%PDF-1.4");
  });

  it("removes the uploaded object when the insert fails", async () => {
    const { repo, storage, objects } = setup();
    repo.insert = async () => {
      throw new Error("db down");
    };
    const cmds = createVehicleFileCommands(repo, storage);
    await expect(cmds.uploadVehicleFile("AAA-111", pdf())).rejects.toThrow("db down");
    expect(objects.size).toBe(0);
  });

  it("still rethrows the insert error when the cleanup fails too", async () => {
    const { repo, storage } = setup();
    repo.insert = async () => {
      throw new Error("db down");
    };
    storage.remove = async () => {
      throw new Error("storage down");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createVehicleFileCommands(repo, storage).uploadVehicleFile("AAA-111", pdf())).rejects.toThrow(
      "db down",
    );
  });

  it("does not touch the database when the upload to storage fails", async () => {
    const { repo, files, storage } = setup();
    storage.put = async () => {
      throw new Error("storage down");
    };
    await expect(createVehicleFileCommands(repo, storage).uploadVehicleFile("AAA-111", pdf())).rejects.toThrow(
      "storage down",
    );
    expect(files.size).toBe(0);
  });

  it("rejects an unknown vehicle", async () => {
    const { cmds } = setup();
    await expect(cmds.uploadVehicleFile("ZZZ-999", pdf())).rejects.toThrow(RuleError);
  });

  it("rejects the 4th file of a category", async () => {
    const { cmds, files, objects } = setup();
    for (let i = 0; i < 3; i++) await cmds.uploadVehicleFile("AAA-111", pdf());
    await expect(cmds.uploadVehicleFile("AAA-111", pdf())).rejects.toThrow(/Elimina/);
    expect(files.size).toBe(3);
    expect(objects.size).toBe(3);
  });

  it("counts per vehicle and per category", async () => {
    const { cmds } = setup();
    for (let i = 0; i < 3; i++) await cmds.uploadVehicleFile("AAA-111", pdf());
    await expect(cmds.uploadVehicleFile("BBB-222", pdf())).resolves.toBeDefined();
    await expect(cmds.uploadVehicleFile("AAA-111", pdf({ category: "TECNO" }))).resolves.toBeDefined();
  });

  it("rejects a disallowed type or an oversized file without storing it", async () => {
    const { cmds, files, objects } = setup();
    await expect(cmds.uploadVehicleFile("AAA-111", pdf({ mimeType: "application/msword" }))).rejects.toThrow(RuleError);
    await expect(
      cmds.uploadVehicleFile("AAA-111", pdf({ data: Buffer.alloc(MAX_FILE_BYTES + 1) })),
    ).rejects.toThrow(RuleError);
    expect(files.size).toBe(0);
    expect(objects.size).toBe(0);
  });
});

describe("deleteVehicleFile", () => {
  it("removes the row and the stored object", async () => {
    const { cmds, files, objects } = setup();
    await cmds.uploadVehicleFile("AAA-111", pdf());
    await cmds.deleteVehicleFile("AAA-111", onlyId(files));
    expect(files.size).toBe(0);
    expect(objects.size).toBe(0);
  });

  it("succeeds even when the storage removal fails", async () => {
    const { repo, files, storage } = setup();
    const cmds = createVehicleFileCommands(repo, storage);
    await cmds.uploadVehicleFile("AAA-111", pdf());
    storage.remove = async () => {
      throw new Error("storage down");
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(cmds.deleteVehicleFile("AAA-111", onlyId(files))).resolves.toMatchObject({ message: /eliminado/i });
    expect(files.size).toBe(0);
    expect(log).toHaveBeenCalled();
  });

  it("refuses a file that belongs to another vehicle", async () => {
    const { cmds, files, objects } = setup();
    await cmds.uploadVehicleFile("AAA-111", pdf());
    await expect(cmds.deleteVehicleFile("BBB-222", onlyId(files))).rejects.toThrow(RuleError);
    expect(files.size).toBe(1);
    expect(objects.size).toBe(1);
  });

  it("refuses a file that does not exist", async () => {
    const { cmds } = setup();
    await expect(cmds.deleteVehicleFile("AAA-111", "nope")).rejects.toThrow(RuleError);
  });
});

describe("getVehicleFile", () => {
  it("reads new rows from storage, only when they belong to the vehicle", async () => {
    const { cmds, files } = setup();
    await cmds.uploadVehicleFile("AAA-111", pdf());
    const id = onlyId(files);
    const file = await cmds.getVehicleFile("AAA-111", id);
    expect(file?.fileName).toBe("soat.pdf");
    expect(file?.data.toString()).toBe("%PDF-1.4");
    expect(await cmds.getVehicleFile("BBB-222", id)).toBeNull();
    expect(await cmds.getVehicleFile("AAA-111", "nope")).toBeNull();
  });

  it("returns null when the stored object is missing", async () => {
    const { cmds, files, objects } = setup();
    await cmds.uploadVehicleFile("AAA-111", pdf());
    objects.clear();
    expect(await cmds.getVehicleFile("AAA-111", onlyId(files))).toBeNull();
  });
});
