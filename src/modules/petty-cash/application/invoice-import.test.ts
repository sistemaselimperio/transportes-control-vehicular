import { describe, expect, it, vi } from "vitest";
import { ExtractionFailedError, ExtractorNotConfiguredError, type ExtractedExpense, type ExtractionOutput, type InvoiceExtractor } from "./invoice-extractor";
import { createInvoiceImport, MAX_PDF_PAGES, type PdfPages } from "./invoice-import";
import { PettyCashError, type PettyCashPorts, type PettyCashStorage } from "./petty-cash-commands";

const USER = "user-1";
const TEMP = `${USER}/tmp/abc`;

const PDF_BYTES = Buffer.from("%PDF-1.7 fake");
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

const found = (over: Partial<ExtractedExpense> = {}): ExtractedExpense => ({
  detail: "Filtro de aceite",
  invoiceNumber: "FE-12",
  supplierNit: "900.123.456",
  supplierName: "Repuestos Norte",
  billedTo: "Fabion Pae7",
  ownerId: 3,
  isElectronicInvoice: false,
  vehiclePlate: "TRNO84",
  vehicleId: 7,
  value: 45_000,
  pages: [1],
  ...over,
});

function ports(over: Partial<PettyCashPorts> = {}): PettyCashPorts {
  return {
    listLedgerKeys: vi.fn(async () => []),
    setInitialBalance: vi.fn(async () => undefined),
    insertLedger: vi.fn(async () => ({ id: 1 })),
    updateLedger: vi.fn(async () => true),
    findLedger: vi.fn(async () => ({ id: 1, date: "2026-11-01" })),
    deleteLedger: vi.fn(async () => []),
    findVehicleByPlate: vi.fn(async (plate: string) => (plate === "ABC-123" ? { id: 8, plate: "ABC-123" } : null)),
    listOwners: vi.fn(async () => [
      { id: 3, name: "FABIAN PAEZ" },
      { id: 4, name: "TRANSPORTE IMPERIO" },
    ]),
    listFleet: vi.fn(async () => [{ id: 7, plate: "TRN-084" }]),
    listSuppliers: vi.fn(async () => []),
    listInvoiceNumbers: vi.fn(async () => [] as Array<string | null>),
    insertExpense: vi.fn(async () => undefined),
    findExpense: vi.fn(async () => null),
    updateExpense: vi.fn(async () => true),
    deleteExpense: vi.fn(async () => true),
    upsertSupplier: vi.fn(async () => undefined),
    ...over,
  };
}

function storage(files: Record<string, Buffer> = { [TEMP]: PDF_BYTES }): PettyCashStorage & { createUploadUrl: (p: string) => Promise<string> } {
  return {
    put: vi.fn(async () => undefined),
    get: vi.fn(async (path: string) => files[path] ?? null),
    remove: vi.fn(async () => undefined),
    createUploadUrl: vi.fn(async (path: string) => `https://storage.test/${path}?token=t`),
  };
}

const pdf = (pageCount = 3): PdfPages => ({
  pageCount: vi.fn(async () => pageCount),
  pick: vi.fn(async (_data: Buffer, pages: readonly number[]) => Buffer.from(`%PDF pages ${pages.join(",")}`)),
});

const extractor = (output: ExtractionOutput | Error): InvoiceExtractor => ({
  extract: vi.fn(async () => {
    if (output instanceof Error) throw output;
    return output;
  }),
});

const upload = { path: TEMP, fileName: "scan.pdf" };

function build(over: { p?: PettyCashPorts; s?: ReturnType<typeof storage>; x?: InvoiceExtractor; f?: PdfPages } = {}) {
  const p = over.p ?? ports();
  const s = over.s ?? storage();
  const f = over.f ?? pdf();
  const x = over.x ?? extractor({ expenses: [found()], unreadablePages: [] });
  return { p, s, f, x, cmds: createInvoiceImport(p, s, x, f) };
}

describe("prepareUpload", () => {
  it("gives a signed URL for a temporary object under the user's folder", async () => {
    const { cmds, s } = build();
    const target = await cmds.prepareUpload(USER);
    expect(target.path).toMatch(new RegExp(`^${USER}/tmp/[0-9a-f-]{36}$`));
    expect(target.uploadUrl).toContain(target.path);
    expect(s.createUploadUrl).toHaveBeenCalledWith(target.path);
  });
});

describe("importExpenses", () => {
  it("inserts every extracted expense with needs_review in the ledger", async () => {
    const { cmds, p } = build({ x: extractor({ expenses: [found(), found({ invoiceNumber: "FE-13", pages: [2] })], unreadablePages: [] }) });
    const result = await cmds.importExpenses(USER, 1, upload);
    expect(result).toEqual({ added: 2, failed: 0, unreadablePages: [] });
    expect(p.insertExpense).toHaveBeenCalledTimes(2);
    expect(p.insertExpense).toHaveBeenNthCalledWith(
      1,
      1,
      expect.objectContaining({
        detail: "Filtro de aceite",
        invoiceNumber: "FE-12",
        nit: "900123456",
        supplierName: "Repuestos Norte",
        company: "FABIAN PAEZ",
        ownerId: 3,
        vehicleId: 7,
        vehicleLabel: "TRN-084",
        value: 45_000,
        needsReview: true,
      }),
    );
  });

  it("keeps the unreadable pages the model reported", async () => {
    const { cmds } = build({ f: pdf(10), x: extractor({ expenses: [found()], unreadablePages: [7, 3, 3, 99] }) });
    const result = await cmds.importExpenses(USER, 1, upload);
    expect(result.unreadablePages).toEqual([3, 7]);
  });

  it("returns an empty result when no invoice was found, and stores nothing", async () => {
    const { cmds, p, s } = build({ x: extractor({ expenses: [], unreadablePages: [] }) });
    expect(await cmds.importExpenses(USER, 1, upload)).toEqual({ added: 0, failed: 0, unreadablePages: [] });
    expect(p.insertExpense).not.toHaveBeenCalled();
    expect(s.put).not.toHaveBeenCalled();
  });

  it("refuses a ledger of another user before reading the file", async () => {
    const { cmds, x, s } = build({ p: ports({ findLedger: vi.fn(async () => null) }) });
    await expect(cmds.importExpenses(USER, 1, upload)).rejects.toThrow(PettyCashError);
    expect(x.extract).not.toHaveBeenCalled();
    expect(s.get).not.toHaveBeenCalled();
  });

  it("still deletes the user's temporary object when the ledger is gone", async () => {
    const { cmds, s } = build({ p: ports({ findLedger: vi.fn(async () => null) }) });
    await expect(cmds.importExpenses(USER, 1, upload)).rejects.toThrow(PettyCashError);
    expect(s.remove).toHaveBeenCalledWith([TEMP]);
  });

  it("refuses an upload path outside the user's temporary folder", async () => {
    const { cmds, s } = build();
    await expect(cmds.importExpenses(USER, 1, { path: "other-user/tmp/abc", fileName: "x.pdf" })).rejects.toThrow(PettyCashError);
    await expect(cmds.importExpenses(USER, 1, { path: `${USER}/tmp/../other/abc`, fileName: "x.pdf" })).rejects.toThrow(PettyCashError);
    expect(s.get).not.toHaveBeenCalled();
    // A path that is not the caller's own is never touched, not even to delete it.
    expect(s.remove).not.toHaveBeenCalled();
  });

  it("explains when the uploaded file is gone", async () => {
    const { cmds } = build({ s: storage({}) });
    await expect(cmds.importExpenses(USER, 1, upload)).rejects.toThrow("No se encontró el archivo");
  });

  it("refuses a file that is neither a PDF nor a photo", async () => {
    const { cmds, x } = build({ s: storage({ [TEMP]: Buffer.from("just text") }) });
    await expect(cmds.importExpenses(USER, 1, upload)).rejects.toThrow("PDF");
    expect(x.extract).not.toHaveBeenCalled();
  });

  it("refuses a PDF with more pages than the maximum", async () => {
    const { cmds, x } = build({ f: pdf(MAX_PDF_PAGES + 2) });
    await expect(cmds.importExpenses(USER, 1, upload)).rejects.toThrow("El PDF tiene 17 hojas; el máximo es 15.");
    expect(x.extract).not.toHaveBeenCalled();
  });

  it("deletes the temporary object whatever the outcome", async () => {
    const ok = build();
    await ok.cmds.importExpenses(USER, 1, upload);
    expect(ok.s.remove).toHaveBeenCalledWith([TEMP]);

    const bad = build({ x: extractor(new ExtractionFailedError("boom")) });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(bad.cmds.importExpenses(USER, 1, upload)).rejects.toThrow(PettyCashError);
    expect(bad.s.remove).toHaveBeenCalledWith([TEMP]);
  });

  it("reports a missing AI setup in Spanish", async () => {
    const { cmds } = build({ x: extractor(new ExtractorNotConfiguredError("no key")) });
    await expect(cmds.importExpenses(USER, 1, upload)).rejects.toThrow("La extracción con IA no está configurada.");
  });

  it("hides an API failure behind a generic message and logs it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { cmds } = build({ x: extractor(new Error("429 secret detail")) });
    const error = await cmds.importExpenses(USER, 1, upload).catch((e: Error) => e);
    expect(error).toBeInstanceOf(PettyCashError);
    expect((error as Error).message).not.toContain("secret");
    expect(spy).toHaveBeenCalled();
  });

  it("drops owner and vehicle ids that do not exist; an unknown company is left empty, never invented", async () => {
    const { cmds, p } = build({
      x: extractor({ expenses: [found({ ownerId: 99, billedTo: "Otra Empresa", vehicleId: 98, vehiclePlate: "zzz 999" })], unreadablePages: [] }),
    });
    await cmds.importExpenses(USER, 1, upload);
    expect(p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ ownerId: null, company: null, vehicleId: null, vehicleLabel: "ZZZ 999" }));
  });

  it("matches the billed name against the owners when the model gave no id", async () => {
    const { cmds, p } = build({ x: extractor({ expenses: [found({ ownerId: null, billedTo: "transporte imperio" })], unreadablePages: [] }) });
    await cmds.importExpenses(USER, 1, upload);
    expect(p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ ownerId: 4, company: "TRANSPORTE IMPERIO" }));
  });

  it("links a fleet vehicle found by its plate text when the model gave no id", async () => {
    const { cmds, p } = build({ x: extractor({ expenses: [found({ vehicleId: null, vehiclePlate: "abc123" })], unreadablePages: [] }) });
    await cmds.importExpenses(USER, 1, upload);
    expect(p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ vehicleId: 8, vehicleLabel: "ABC-123" }));
  });

  it("leaves the unread fields empty", async () => {
    const { cmds, p } = build({
      x: extractor({
        expenses: [found({ supplierNit: null, supplierName: null, billedTo: null, ownerId: null, vehiclePlate: null, vehicleId: null, value: null, invoiceNumber: null })],
        unreadablePages: [],
      }),
    });
    await cmds.importExpenses(USER, 1, upload);
    expect(p.insertExpense).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nit: null, supplierName: null, company: null, ownerId: null, vehicleId: null, vehicleLabel: null, value: null, invoiceNumber: null }),
    );
  });

  it("treats a zero or negative value as unread", async () => {
    const { cmds, p } = build({ x: extractor({ expenses: [found({ value: 0 })], unreadablePages: [] }) });
    await cmds.importExpenses(USER, 1, upload);
    expect(p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ value: null }));
  });

  it("uses the catalog NIT when only the supplier name was read", async () => {
    const { cmds, p } = build({
      p: ports({ listSuppliers: vi.fn(async () => [{ nit: "800555", supplierName: "Repuestos Norte S.A.S.", responsibilityType: "none_active" as const }]) }),
      x: extractor({ expenses: [found({ supplierNit: null })], unreadablePages: [] }),
    });
    await cmds.importExpenses(USER, 1, upload);
    expect(p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ nit: "800555", responsibilityType: "none_active" }));
  });

  it("marks electronic invoicers, and otherwise uses the responsibility known for the NIT", async () => {
    const known = ports({ listSuppliers: vi.fn(async () => [{ nit: "900123456", supplierName: null, responsibilityType: "none_active" as const }]) });
    const a = build({ p: known, x: extractor({ expenses: [found({ isElectronicInvoice: true })], unreadablePages: [] }) });
    await a.cmds.importExpenses(USER, 1, upload);
    expect(a.p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ responsibilityType: "electronic_invoicer" }));

    const b = build({ p: known });
    await b.cmds.importExpenses(USER, 1, upload);
    expect(b.p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ responsibilityType: "none_active" }));

    const c = build();
    await c.cmds.importExpenses(USER, 1, upload);
    expect(c.p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ responsibilityType: null }));
  });

  it("flags a possible duplicate of an earlier expense", async () => {
    const { cmds, p } = build({ p: ports({ listInvoiceNumbers: vi.fn(async () => ["fe 12"]) }) });
    await cmds.importExpenses(USER, 1, upload);
    expect(p.listInvoiceNumbers).toHaveBeenCalledWith(USER, "900123456");
    expect(p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ possibleDuplicate: true }));
  });

  it("stores only the pages of each invoice as its own PDF attachment", async () => {
    const { cmds, p, s, f } = build({
      x: extractor({ expenses: [found({ pages: [2, 1] }), found({ invoiceNumber: "FE-13", pages: [3, 3, 9] })], unreadablePages: [] }),
    });
    await cmds.importExpenses(USER, 1, upload);
    expect(f.pick).toHaveBeenNthCalledWith(1, PDF_BYTES, [1, 2]);
    expect(f.pick).toHaveBeenNthCalledWith(2, PDF_BYTES, [3]);
    const paths = vi.mocked(s.put).mock.calls.map((c) => c[0]);
    expect(new Set(paths).size).toBe(2);
    expect(paths.every((path) => path.startsWith(`${USER}/`) && !path.includes("/tmp/"))).toBe(true);
    const first = vi.mocked(p.insertExpense).mock.calls[0][1].attachment;
    expect(first).toEqual({ path: paths[0], name: "scan-hojas-1-2.pdf", mimeType: "application/pdf" });
  });

  it("attaches the photo to its expense", async () => {
    const { cmds, p, s } = build({ s: storage({ [TEMP]: JPEG_BYTES }), x: extractor({ expenses: [found({ pages: [1] })], unreadablePages: [] }) });
    await cmds.importExpenses(USER, 1, { path: TEMP, fileName: "foto.jpg" });
    expect(s.put).toHaveBeenCalledWith(expect.stringMatching(`^${USER}/`), JPEG_BYTES, "image/jpeg");
    expect(vi.mocked(p.insertExpense).mock.calls[0][1].attachment).toMatchObject({ name: "foto.jpg", mimeType: "image/jpeg" });
  });

  it("does not need the page count of a photo", async () => {
    const { cmds, f } = build({ s: storage({ [TEMP]: JPEG_BYTES }) });
    await cmds.importExpenses(USER, 1, { path: TEMP, fileName: "foto.jpg" });
    expect(f.pageCount).not.toHaveBeenCalled();
  });

  it("keeps going when one expense cannot be saved, removing its attachment", async () => {
    const insert = vi.fn().mockRejectedValueOnce(new Error("db")).mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { cmds, s } = build({
      p: ports({ insertExpense: insert }),
      x: extractor({ expenses: [found(), found({ invoiceNumber: "FE-13", pages: [2] })], unreadablePages: [] }),
    });
    const result = await cmds.importExpenses(USER, 1, upload);
    expect(result).toMatchObject({ added: 1, failed: 1 });
    const firstPath = vi.mocked(s.put).mock.calls[0][0];
    expect(s.remove).toHaveBeenCalledWith([firstPath]);
  });

  it("leaves the supplier catalog alone: it only learns from reviewed expenses", async () => {
    const { cmds, p } = build();
    await cmds.importExpenses(USER, 1, upload);
    expect(p.upsertSupplier).not.toHaveBeenCalled();
  });
});
