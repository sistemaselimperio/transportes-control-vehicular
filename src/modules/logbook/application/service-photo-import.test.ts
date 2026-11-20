import { describe, expect, it, vi } from "vitest";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { createLogbookCommands } from "./logbook-commands";
import type { LogbookRepository } from "./logbook-ports";
import {
  ServiceExtractionFailedError,
  ServiceExtractorNotConfiguredError,
  type ExtractedService,
  type ServiceExtractor,
} from "./service-extractor";
import { MAX_DRAFTS, MAX_PHOTO_BYTES, createServicePhotoImport, saveServiceRows, toDrafts } from "./service-photo-import";

const item = (over: Partial<ExtractedService> = {}): ExtractedService => ({
  date: "2026-03-05",
  plate: "TRN-084",
  kind: "PREVENTIVE",
  description: "Filtro de aceite, mano de obra",
  provider: "Taller Paez",
  km: 359174,
  price: 45000,
  notes: null,
  ...over,
});

const context = { plates: ["TRN-084", "ABC-123"], providers: ["Taller Páez"], defaultPlate: null };

describe("toDrafts", () => {
  it("turns a row into form-shaped strings", () => {
    expect(toDrafts([item()], context)).toEqual([
      {
        plate: "TRN-084",
        date: "2026-03-05",
        kind: "PREVENTIVE",
        description: "Filtro de aceite, mano de obra",
        provider: "Taller Páez",
        km: "359174",
        price: "45000",
        notes: "",
      },
    ]);
  });

  it("matches the plate ignoring case, spaces and dashes, and drops invented ones", () => {
    const [a, b] = toDrafts([item({ plate: "trn 084" }), item({ plate: "ZZZ-999" })], context);
    expect(a.plate).toBe("TRN-084");
    expect(b.plate).toBe("");
  });

  it("uses the default plate for rows that state no vehicle", () => {
    const [row] = toDrafts([item({ plate: null })], { ...context, defaultPlate: "abc123" });
    expect(row.plate).toBe("ABC-123");
  });

  it("keeps unreadable values empty and defaults the kind like the form", () => {
    const [row] = toDrafts([item({ date: "05/03/2026", km: -3, price: 0, kind: null, provider: null })], context);
    expect(row).toMatchObject({ date: "", km: "", price: "", kind: "CORRECTIVE", provider: "" });
  });

  it("skips rows with nothing in them and caps the count", () => {
    const empty = item({ description: "  ", price: null, provider: null });
    expect(toDrafts([empty], context)).toEqual([]);
    expect(toDrafts(Array.from({ length: MAX_DRAFTS + 5 }, () => item()), context)).toHaveLength(MAX_DRAFTS);
  });
});

describe("createServicePhotoImport", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const setup = (extract: ServiceExtractor["extract"]) =>
    createServicePhotoImport({
      extractor: { extract },
      loadPlates: async () => ["TRN-084"],
      loadProviders: async () => [],
      today: () => "2026-10-17",
    });

  it("passes the lists and the matched default plate to the extractor", async () => {
    const extract = vi.fn<ServiceExtractor["extract"]>(async () => ({ services: [item({ plate: null })] }));
    const rows = await setup(extract).read({ fileName: "a.jpg", data: jpeg }, "trn084");
    expect(extract).toHaveBeenCalledWith(expect.objectContaining({ kind: "image", mimeType: "image/jpeg" }), {
      plates: ["TRN-084"],
      providers: [],
      defaultPlate: "TRN-084",
      today: "2026-10-17",
    });
    expect(rows[0].plate).toBe("TRN-084");
  });

  it("refuses an empty, huge or unknown file before calling the AI", async () => {
    const extract = vi.fn<ServiceExtractor["extract"]>();
    const flow = setup(extract);
    await expect(flow.read({ fileName: "a", data: Buffer.alloc(0) }, null)).rejects.toThrow(RuleError);
    await expect(flow.read({ fileName: "a", data: Buffer.alloc(MAX_PHOTO_BYTES + 1) }, null)).rejects.toThrow("4 MB");
    await expect(flow.read({ fileName: "a", data: Buffer.from("hello") }, null)).rejects.toThrow("JPG, PNG");
    expect(extract).not.toHaveBeenCalled();
  });

  it("explains a missing AI setup and a model failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const notConfigured = setup(async () => {
      throw new ServiceExtractorNotConfiguredError("no key");
    });
    await expect(notConfigured.read({ fileName: "a", data: jpeg }, null)).rejects.toThrow("no está configurada");
    const failed = setup(async () => {
      throw new ServiceExtractionFailedError("boom");
    });
    await expect(failed.read({ fileName: "a", data: jpeg }, null)).rejects.toThrow("No se pudo leer");
  });
});

describe("saveServiceRows", () => {
  const repoCalls: unknown[] = [];
  const repo: LogbookRepository = {
    findVehicle: async (plate) => (plate === "TRN-084" ? { id: 1, status: "ACTIVE", isTrailer: false } : null),
    findEntryVehicle: async () => null,
    create: async (kind, vehicleId, values) => void repoCalls.push({ kind, vehicleId, values }),
    update: async () => {},
    remove: async () => {},
    removeMany: async () => 0,
  };
  const commands = createLogbookCommands(repo, () => "2026-10-17");
  const row = {
    plate: "TRN-084",
    date: "2026-03-05",
    kind: "PREVENTIVE",
    description: "Filtro",
    provider: "",
    km: "",
    price: "45000",
    notes: "",
  };

  it("saves the good rows and reports the bad ones by position", async () => {
    repoCalls.length = 0;
    const result = await saveServiceRows(commands, [
      row,
      { ...row, description: "" },
      { ...row, plate: "NOP-000" },
      { ...row, date: "2027-01-01" },
      row,
    ]);
    expect(result.saved).toBe(2);
    expect(result.errors.map((e) => e.index)).toEqual([1, 2, 3]);
    expect(result.errors[0].error).toBe("Describe el mantenimiento.");
    expect(repoCalls).toHaveLength(2);
    expect(repoCalls[0]).toMatchObject({ kind: "service", vehicleId: 1, values: { price: 45000, km: null, provider: null } });
  });

  it("refuses an empty or oversized batch", async () => {
    await expect(saveServiceRows(commands, [])).rejects.toThrow(RuleError);
    await expect(saveServiceRows(commands, Array.from({ length: MAX_DRAFTS + 1 }, () => row))).rejects.toThrow(RuleError);
  });
});
