import { describe, expect, it, vi } from "vitest";
import { createPettyCashCommands, LedgerNumberTakenError, PettyCashError, type AttachmentUpload, type PettyCashPorts, type PettyCashStorage } from "./petty-cash-commands";
import type { ExpenseInput, LedgerInput } from "./petty-cash-schemas";

const USER = "user-1";

const ledgerInput = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  date: "2026-11-07",
  compenseAmount: 1_000_000,
  openingBalance: null,
  ...over,
});

const expenseInput = (over: Partial<ExpenseInput> = {}): ExpenseInput => ({
  detail: "Papel",
  invoiceNumber: null,
  efk: null,
  nit: "1073382044",
  supplierName: "Papelería X",
  company: "FABIAN PAEZ",
  responsibilityType: "none_active",
  vehicle: "ABC 123",
  value: 45_000,
  ...over,
});

function ports(over: Partial<PettyCashPorts> = {}): PettyCashPorts {
  return {
    listLedgerKeys: vi.fn(async () => [{ id: 1, date: "2026-10-01", number: 1 }]),
    setInitialBalance: vi.fn(async () => undefined),
    insertLedger: vi.fn(async () => ({ id: 9 })),
    updateLedger: vi.fn(async () => true),
    findLedger: vi.fn(async () => ({ id: 1, date: "2026-10-01" })),
    deleteLedger: vi.fn(async () => ["u/a.pdf"] as string[] | null),
    findVehicleByPlate: vi.fn(async (plate: string) => (plate === "ABC-123" ? { id: 7, plate: "ABC-123" } : null)),
    insertExpense: vi.fn(async () => undefined),
    findExpense: vi.fn(async () => ({ id: 4, ledgerId: 1, attachmentPath: "u/old.pdf" as string | null })),
    updateExpense: vi.fn(async () => true),
    deleteExpense: vi.fn(async () => true),
    upsertSupplier: vi.fn(async () => undefined),
    listOwners: vi.fn(async () => [{ id: 3, name: "FABIAN PAEZ" }]),
    listInvoiceNumbers: vi.fn(async () => [] as Array<string | null>),
    listFleet: vi.fn(async () => [{ id: 7, plate: "ABC-123" }]),
    listSuppliers: vi.fn(async () => []),
    ...over,
  };
}

const storage = (): PettyCashStorage => ({
  put: vi.fn(async () => undefined),
  get: vi.fn(async () => null),
  remove: vi.fn(async () => undefined),
});

const pdf = (over: Partial<AttachmentUpload> = {}): AttachmentUpload => ({
  fileName: "factura.pdf",
  mimeType: "application/pdf",
  data: Buffer.from("x"),
  ...over,
});

describe("createLedger", () => {
  it("stores the typed opening balance for the first ledger of the user", async () => {
    const p = ports({ listLedgerKeys: vi.fn(async () => []) });
    await createPettyCashCommands(p, storage()).createLedger(USER, ledgerInput({ openingBalance: 200_000 }));
    expect(p.setInitialBalance).toHaveBeenCalledWith(USER, 200_000);
    expect(p.insertLedger).toHaveBeenCalledWith(USER, { date: "2026-11-07", compenseAmount: 1_000_000, number: 1 });
  });

  it("starts from zero when the first opening balance is left blank", async () => {
    const p = ports({ listLedgerKeys: vi.fn(async () => []) });
    await createPettyCashCommands(p, storage()).createLedger(USER, ledgerInput());
    expect(p.setInitialBalance).toHaveBeenCalledWith(USER, 0);
  });

  it("never touches the initial balance once there are ledgers and the new one is not the first", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).createLedger(USER, ledgerInput({ openingBalance: 5 }));
    expect(p.setInitialBalance).not.toHaveBeenCalled();
    expect(p.insertLedger).toHaveBeenCalled();
  });

  it("stores the typed opening balance when the new ledger is dated before every existing one", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).createLedger(USER, ledgerInput({ date: "2026-09-30", openingBalance: 750_000 }));
    expect(p.setInitialBalance).toHaveBeenCalledWith(USER, 750_000);
    expect(p.insertLedger).toHaveBeenCalledWith(USER, { date: "2026-09-30", compenseAmount: 1_000_000, number: 2 });
  });

  it("starts from zero when a new first ledger is saved without an opening balance", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).createLedger(USER, ledgerInput({ date: "2026-09-30" }));
    expect(p.setInitialBalance).toHaveBeenCalledWith(USER, 0);
  });

  it("ignores the opening balance of a ledger dated the same day as the earliest", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).createLedger(USER, ledgerInput({ date: "2026-10-01", openingBalance: 9 }));
    expect(p.setInitialBalance).not.toHaveBeenCalled();
  });
});

describe("createLedger numbering", () => {
  it("gives the first ledger of a user the number 1 and returns it with its id", async () => {
    const p = ports({ listLedgerKeys: vi.fn(async () => []) });
    const created = await createPettyCashCommands(p, storage()).createLedger(USER, ledgerInput());
    expect(created).toEqual({ id: 9, number: 1 });
  });

  it("takes the number after the highest one even when it is backdated or earlier ones were deleted", async () => {
    const p = ports({
      listLedgerKeys: vi.fn(async () => [
        { id: 4, date: "2026-10-01", number: 7 },
        { id: 2, date: "2026-11-01", number: 3 },
      ]),
    });
    const created = await createPettyCashCommands(p, storage()).createLedger(USER, ledgerInput({ date: "2026-01-01" }));
    expect(p.insertLedger).toHaveBeenCalledWith(USER, { date: "2026-01-01", compenseAmount: 1_000_000, number: 8 });
    expect(created.number).toBe(8);
  });

  it("re-reads the numbers and retries when a concurrent create took the number", async () => {
    const listLedgerKeys = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1, date: "2026-10-01", number: 1 }])
      .mockResolvedValueOnce([
        { id: 1, date: "2026-10-01", number: 1 },
        { id: 2, date: "2026-10-02", number: 2 },
      ]);
    const insertLedger = vi.fn().mockRejectedValueOnce(new LedgerNumberTakenError()).mockResolvedValueOnce({ id: 10 });
    const p = ports({ listLedgerKeys, insertLedger });
    const created = await createPettyCashCommands(p, storage()).createLedger(USER, ledgerInput());
    expect(insertLedger).toHaveBeenNthCalledWith(2, USER, { date: "2026-11-07", compenseAmount: 1_000_000, number: 3 });
    expect(created).toEqual({ id: 10, number: 3 });
  });

  it("gives up after a few collisions", async () => {
    const insertLedger = vi.fn().mockRejectedValue(new LedgerNumberTakenError());
    const p = ports({ insertLedger });
    await expect(createPettyCashCommands(p, storage()).createLedger(USER, ledgerInput())).rejects.toThrow(LedgerNumberTakenError);
    expect(insertLedger).toHaveBeenCalledTimes(5);
  });

  it("does not swallow other insert errors", async () => {
    const p = ports({ insertLedger: vi.fn().mockRejectedValue(new Error("db down")) });
    await expect(createPettyCashCommands(p, storage()).createLedger(USER, ledgerInput())).rejects.toThrow("db down");
    expect(p.insertLedger).toHaveBeenCalledTimes(1);
  });
});

describe("updateLedger", () => {
  it("changes the initial balance only when editing the chronologically first ledger", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).updateLedger(USER, 1, ledgerInput({ openingBalance: 300 }));
    expect(p.setInitialBalance).toHaveBeenCalledWith(USER, 300);
  });

  it("ignores a typed opening balance on a later ledger", async () => {
    const p = ports({
      findLedger: vi.fn(async () => ({ id: 2, date: "2026-11-01" })),
      listLedgerKeys: vi.fn(async () => [
        { id: 1, date: "2026-10-01", number: 1 },
        { id: 2, date: "2026-11-01", number: 2 },
      ]),
    });
    await createPettyCashCommands(p, storage()).updateLedger(USER, 2, ledgerInput({ openingBalance: 300 }));
    expect(p.setInitialBalance).not.toHaveBeenCalled();
    expect(p.updateLedger).toHaveBeenCalled();
  });

  it("stores the opening balance when moving the date makes the ledger the first", async () => {
    const keys = [
      { id: 1, date: "2026-10-01", number: 1 },
      { id: 2, date: "2026-11-01", number: 2 },
    ];
    const p = ports({
      findLedger: vi.fn(async () => ({ id: 2, date: "2026-11-01" })),
      listLedgerKeys: vi.fn(async () => keys),
    });
    await createPettyCashCommands(p, storage()).updateLedger(USER, 2, ledgerInput({ date: "2026-09-15", openingBalance: 400 }));
    expect(p.setInitialBalance).toHaveBeenCalledWith(USER, 400);
  });

  it("leaves the initial balance when none is typed", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).updateLedger(USER, 1, ledgerInput());
    expect(p.setInitialBalance).not.toHaveBeenCalled();
  });

  it("refuses a ledger of another user", async () => {
    const p = ports({ findLedger: vi.fn(async () => null) });
    await expect(createPettyCashCommands(p, storage()).updateLedger(USER, 1, ledgerInput())).rejects.toThrow(PettyCashError);
    expect(p.updateLedger).not.toHaveBeenCalled();
  });
});

describe("deleteLedger", () => {
  it("removes the stored attachments of its expenses", async () => {
    const s = storage();
    await createPettyCashCommands(ports(), s).deleteLedger(USER, 1);
    expect(s.remove).toHaveBeenCalledWith(["u/a.pdf"]);
  });

  it("refuses a ledger of another user", async () => {
    const p = ports({ deleteLedger: vi.fn(async () => null) });
    await expect(createPettyCashCommands(p, storage()).deleteLedger(USER, 1)).rejects.toThrow(PettyCashError);
  });

  it("does not fail when the files cannot be removed", async () => {
    const s = storage();
    vi.mocked(s.remove).mockRejectedValue(new Error("down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(createPettyCashCommands(ports(), s).deleteLedger(USER, 1)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe("addExpense", () => {
  it("links a fleet vehicle by its plate", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).addExpense(USER, 1, expenseInput(), null);
    expect(p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ vehicleId: 7, vehicleLabel: "ABC-123", attachment: null }));
  });

  it("keeps free text, in capitals, when it is not a fleet vehicle", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).addExpense(USER, 1, expenseInput({ vehicle: "planta f. miramar" }), null);
    expect(p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ vehicleId: null, vehicleLabel: "PLANTA F. MIRAMAR" }));
  });

  it("refuses a ledger of another user", async () => {
    const p = ports({ findLedger: vi.fn(async () => null) });
    await expect(createPettyCashCommands(p, storage()).addExpense(USER, 1, expenseInput(), null)).rejects.toThrow(PettyCashError);
    expect(p.insertExpense).not.toHaveBeenCalled();
  });

  it("saves the issuing supplier in the catalog", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).addExpense(USER, 1, expenseInput(), null);
    expect(p.upsertSupplier).toHaveBeenCalledWith({ nit: "1073382044", supplierName: "Papelería X", responsibilityType: "none_active" });
  });

  it("does not touch the catalog without a supplier name or responsibility", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).addExpense(USER, 1, expenseInput({ supplierName: null, responsibilityType: null }), null);
    expect(p.upsertSupplier).not.toHaveBeenCalled();
  });

  it("links the owner the invoice is billed to and keeps its canonical name", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).addExpense(USER, 1, expenseInput({ company: "fabián páez" }), null);
    expect(p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ ownerId: 3, company: "FABIAN PAEZ" }));
  });

  it("refuses a billed company that is not one of the existing companies", async () => {
    const p = ports();
    await expect(
      createPettyCashCommands(p, storage()).addExpense(USER, 1, expenseInput({ company: "Otra SAS" }), null),
    ).rejects.toThrow("Elige una empresa de la lista.");
    expect(p.insertExpense).not.toHaveBeenCalled();
  });

  it("allows leaving the billed company empty (the expense stays pending)", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).addExpense(USER, 1, expenseInput({ company: null }), null);
    expect(p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ ownerId: null, company: null }));
  });

  it("saves a manual expense as reviewed and not duplicated", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).addExpense(USER, 1, expenseInput({ invoiceNumber: "FE-1" }), null);
    expect(p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ needsReview: false, possibleDuplicate: false }));
  });

  it("flags a possible duplicate: same NIT and invoice number as another expense of the user", async () => {
    const p = ports({ listInvoiceNumbers: vi.fn(async () => ["fe 1"]) });
    await createPettyCashCommands(p, storage()).addExpense(USER, 1, expenseInput({ invoiceNumber: "FE-1" }), null);
    expect(p.listInvoiceNumbers).toHaveBeenCalledWith(USER, "1073382044", undefined);
    expect(p.insertExpense).toHaveBeenCalledWith(1, expect.objectContaining({ possibleDuplicate: true }));
  });

  it("uploads the attachment before inserting the row", async () => {
    const p = ports();
    const s = storage();
    await createPettyCashCommands(p, s).addExpense(USER, 1, expenseInput(), pdf());
    expect(s.put).toHaveBeenCalledTimes(1);
    const inserted = vi.mocked(p.insertExpense).mock.calls[0][1];
    expect(inserted.attachment).toEqual({ path: expect.stringContaining(`${USER}/`), name: "factura.pdf", mimeType: "application/pdf" });
  });

  it("removes the uploaded object when the insert fails", async () => {
    const p = ports({ insertExpense: vi.fn(async () => Promise.reject(new Error("db"))) });
    const s = storage();
    await expect(createPettyCashCommands(p, s).addExpense(USER, 1, expenseInput(), pdf())).rejects.toThrow("db");
    expect(s.remove).toHaveBeenCalledTimes(1);
  });

  it("refuses an unsupported or oversized attachment before storing", async () => {
    const s = storage();
    const cmds = createPettyCashCommands(ports(), s);
    await expect(cmds.addExpense(USER, 1, expenseInput(), pdf({ mimeType: "text/plain" }))).rejects.toThrow(PettyCashError);
    await expect(cmds.addExpense(USER, 1, expenseInput(), pdf({ data: Buffer.alloc(5 * 1024 * 1024) }))).rejects.toThrow(PettyCashError);
    expect(s.put).not.toHaveBeenCalled();
  });
});

describe("updateExpense", () => {
  it("marks the expense as reviewed", async () => {
    const p = ports();
    await createPettyCashCommands(p, storage()).updateExpense(USER, 4, expenseInput(), { upload: null, remove: false });
    expect(vi.mocked(p.updateExpense).mock.calls[0][1]).toMatchObject({ needsReview: false });
  });

  it("looks for duplicates among the other expenses only", async () => {
    const p = ports({ listInvoiceNumbers: vi.fn(async () => ["FE-1"]) });
    await createPettyCashCommands(p, storage()).updateExpense(USER, 4, expenseInput({ invoiceNumber: "FE-1" }), { upload: null, remove: false });
    expect(p.listInvoiceNumbers).toHaveBeenCalledWith(USER, "1073382044", 4);
    expect(vi.mocked(p.updateExpense).mock.calls[0][1]).toMatchObject({ possibleDuplicate: true });
  });

  it("keeps the current attachment by default", async () => {
    const p = ports();
    const s = storage();
    await createPettyCashCommands(p, s).updateExpense(USER, 4, expenseInput(), { upload: null, remove: false });
    expect(vi.mocked(p.updateExpense).mock.calls[0][1].attachment).toBeUndefined();
    expect(s.remove).not.toHaveBeenCalled();
  });

  it("replaces the attachment and removes the old object", async () => {
    const p = ports();
    const s = storage();
    await createPettyCashCommands(p, s).updateExpense(USER, 4, expenseInput(), { upload: pdf(), remove: false });
    expect(vi.mocked(p.updateExpense).mock.calls[0][1].attachment).toMatchObject({ name: "factura.pdf" });
    expect(s.remove).toHaveBeenCalledWith(["u/old.pdf"]);
  });

  it("drops the attachment when asked", async () => {
    const p = ports();
    const s = storage();
    await createPettyCashCommands(p, s).updateExpense(USER, 4, expenseInput(), { upload: null, remove: true });
    expect(vi.mocked(p.updateExpense).mock.calls[0][1].attachment).toBeNull();
    expect(s.remove).toHaveBeenCalledWith(["u/old.pdf"]);
  });

  it("refuses an expense of another user", async () => {
    const p = ports({ findExpense: vi.fn(async () => null) });
    await expect(
      createPettyCashCommands(p, storage()).updateExpense(USER, 4, expenseInput(), { upload: null, remove: false }),
    ).rejects.toThrow(PettyCashError);
  });
});

describe("deleteExpense", () => {
  it("deletes the row and its stored file", async () => {
    const s = storage();
    await createPettyCashCommands(ports(), s).deleteExpense(USER, 4);
    expect(s.remove).toHaveBeenCalledWith(["u/old.pdf"]);
  });

  it("refuses an expense of another user", async () => {
    const p = ports({ findExpense: vi.fn(async () => null) });
    await expect(createPettyCashCommands(p, storage()).deleteExpense(USER, 4)).rejects.toThrow(PettyCashError);
    expect(p.deleteExpense).not.toHaveBeenCalled();
  });
});
