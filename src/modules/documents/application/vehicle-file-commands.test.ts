import { describe, expect, it } from "vitest";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { MAX_FILE_BYTES, type FileCategory } from "../domain/vehicle-file-rules";
import { createVehicleFileCommands } from "./vehicle-file-commands";
import type { NewVehicleFile, VehicleFileRepository } from "./vehicle-file-ports";

const PLATES: Record<string, number> = { "AAA-111": 1, "BBB-222": 2 };

/** In-memory fake that keeps files in a map. */
function fakeRepo() {
  const files = new Map<string, NewVehicleFile & { id: string }>();
  let next = 0;
  const repo: VehicleFileRepository = {
    findVehicleId: async (plate) => PLATES[plate] ?? null,
    countByCategory: async (vehicleId, category: FileCategory) =>
      [...files.values()].filter((f) => f.vehicleId === vehicleId && f.category === category).length,
    listByVehicle: async () => [],
    insert: async (file) => void files.set(`f${++next}`, { ...file, id: `f${next}` }),
    findMeta: async (id) => {
      const f = files.get(id);
      return f ? { id, vehicleId: f.vehicleId, fileName: f.fileName } : null;
    },
    remove: async (id) => void files.delete(id),
    getContent: async (id) => {
      const f = files.get(id);
      return f ? { vehicleId: f.vehicleId, fileName: f.fileName, mimeType: f.mimeType, data: f.data } : null;
    },
  };
  return { repo, files };
}

const pdf = (overrides = {}) => ({
  category: "SOAT" as FileCategory,
  fileName: "soat.pdf",
  mimeType: "application/pdf",
  data: Buffer.from("%PDF-1.4"),
  ...overrides,
});

describe("uploadVehicleFile", () => {
  it("stores the file for the vehicle", async () => {
    const { repo, files } = fakeRepo();
    const result = await createVehicleFileCommands(repo).uploadVehicleFile("AAA-111", pdf());
    expect(result.message).toMatch(/subido/i);
    expect([...files.values()]).toHaveLength(1);
    expect([...files.values()][0]).toMatchObject({ vehicleId: 1, category: "SOAT", fileName: "soat.pdf" });
  });

  it("rejects an unknown vehicle", async () => {
    const { repo } = fakeRepo();
    await expect(createVehicleFileCommands(repo).uploadVehicleFile("ZZZ-999", pdf())).rejects.toThrow(RuleError);
  });

  it("rejects the 4th file of a category", async () => {
    const { repo, files } = fakeRepo();
    const cmds = createVehicleFileCommands(repo);
    for (let i = 0; i < 3; i++) await cmds.uploadVehicleFile("AAA-111", pdf());
    await expect(cmds.uploadVehicleFile("AAA-111", pdf())).rejects.toThrow(/Elimina/);
    expect(files.size).toBe(3);
  });

  it("counts per vehicle and per category", async () => {
    const { repo } = fakeRepo();
    const cmds = createVehicleFileCommands(repo);
    for (let i = 0; i < 3; i++) await cmds.uploadVehicleFile("AAA-111", pdf());
    await expect(cmds.uploadVehicleFile("BBB-222", pdf())).resolves.toBeDefined();
    await expect(cmds.uploadVehicleFile("AAA-111", pdf({ category: "TECNO" }))).resolves.toBeDefined();
  });

  it("rejects a disallowed type or an oversized file without storing it", async () => {
    const { repo, files } = fakeRepo();
    const cmds = createVehicleFileCommands(repo);
    await expect(cmds.uploadVehicleFile("AAA-111", pdf({ mimeType: "application/msword" }))).rejects.toThrow(RuleError);
    await expect(
      cmds.uploadVehicleFile("AAA-111", pdf({ data: Buffer.alloc(MAX_FILE_BYTES + 1) })),
    ).rejects.toThrow(RuleError);
    expect(files.size).toBe(0);
  });
});

describe("deleteVehicleFile", () => {
  it("removes a file of that vehicle", async () => {
    const { repo, files } = fakeRepo();
    const cmds = createVehicleFileCommands(repo);
    await cmds.uploadVehicleFile("AAA-111", pdf());
    await cmds.deleteVehicleFile("AAA-111", "f1");
    expect(files.size).toBe(0);
  });

  it("refuses a file that belongs to another vehicle", async () => {
    const { repo, files } = fakeRepo();
    const cmds = createVehicleFileCommands(repo);
    await cmds.uploadVehicleFile("AAA-111", pdf());
    await expect(cmds.deleteVehicleFile("BBB-222", "f1")).rejects.toThrow(RuleError);
    expect(files.size).toBe(1);
  });

  it("refuses a file that does not exist", async () => {
    const { repo } = fakeRepo();
    await expect(createVehicleFileCommands(repo).deleteVehicleFile("AAA-111", "nope")).rejects.toThrow(RuleError);
  });
});

describe("getVehicleFile", () => {
  it("returns the content only when it belongs to the vehicle", async () => {
    const { repo } = fakeRepo();
    const cmds = createVehicleFileCommands(repo);
    await cmds.uploadVehicleFile("AAA-111", pdf());
    expect((await cmds.getVehicleFile("AAA-111", "f1"))?.fileName).toBe("soat.pdf");
    expect(await cmds.getVehicleFile("BBB-222", "f1")).toBeNull();
    expect(await cmds.getVehicleFile("AAA-111", "nope")).toBeNull();
  });
});
