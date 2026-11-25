import { describe, expect, it, vi } from "vitest";
import {
  extractionSchema,
  extractReceiptDrafts,
  ExtractionFailedError,
  ExtractorNotConfiguredError,
  toDraft,
  type ExtractedReceipt,
  type ReceiptExtractor,
} from "./receipt-extractor";
import { CoteroError } from "../domain/settlement-rules";

const extracted = (over: Partial<ExtractedReceipt> = {}): ExtractedReceipt => ({
  receiptNumber: "T 0248",
  date: "11/11/2026",
  destination: "Finca La Esperanza",
  remissions: ["44092", "440493-440491"],
  tons: 33.213,
  vehiclePlate: "ABC 123",
  trailerPlate: "R 21396",
  crew: "H2",
  coteroName: "Juan Perez",
  coteroDocument: "1056507092",
  driverName: "Pedro Gomez",
  amount: 325498,
  ...over,
});

describe("extractionSchema", () => {
  it("accepts an array of receipts with nullable fields", () => {
    const parsed = extractionSchema.parse({
      receipts: [
        { ...extracted(), crew: null, trailerPlate: null, coteroDocument: null, amount: null, tons: null, date: null },
      ],
    });
    expect(parsed.receipts).toHaveLength(1);
  });

  it("rejects an answer of the wrong shape", () => {
    expect(extractionSchema.safeParse({ receipts: [{ receiptNumber: 5 }] }).success).toBe(false);
    expect(extractionSchema.safeParse({}).success).toBe(false);
  });
});

describe("toDraft", () => {
  it("turns what the AI read into the text a reviewer edits", () => {
    expect(toDraft(extracted())).toEqual({
      receiptNumber: "T 0248",
      date: "2026-11-11",
      destination: "Finca La Esperanza",
      remissions: "44092 440493-440491",
      tons: "33.213",
      vehiclePlate: "ABC 123",
      trailerPlate: "R 21396",
      crew: "H2",
      coteroName: "Juan Perez",
      coteroDocument: "1056507092",
      driverName: "Pedro Gomez",
      amount: "325498",
    });
  });

  it("leaves unread fields empty and never invents them", () => {
    const draft = toDraft(
      extracted({ receiptNumber: null, date: null, tons: null, amount: null, coteroName: null, vehiclePlate: null, remissions: [] }),
    );
    expect(draft).toMatchObject({ receiptNumber: "", date: "", tons: "", amount: "", coteroName: "", vehiclePlate: "", remissions: "" });
  });

  it("drops a date that is not a real day", () => {
    expect(toDraft(extracted({ date: "99/99/2026" })).date).toBe("");
  });
});

describe("extractReceiptDrafts", () => {
  const image = { data: Buffer.from("x"), mimeType: "image/jpeg" as const };

  it("returns one draft per receipt found", async () => {
    const extractor: ReceiptExtractor = { extract: vi.fn(async () => ({ receipts: [extracted(), extracted({ receiptNumber: "T 428" })] })) };
    const drafts = await extractReceiptDrafts(extractor, image);
    expect(drafts.map((d) => d.receiptNumber)).toEqual(["T 0248", "T 428"]);
  });

  it("says the AI is not set up", async () => {
    const extractor: ReceiptExtractor = {
      extract: vi.fn(async () => {
        throw new ExtractorNotConfiguredError("no key");
      }),
    };
    await expect(extractReceiptDrafts(extractor, image)).rejects.toThrow(CoteroError);
    await expect(extractReceiptDrafts(extractor, image)).rejects.toThrow(/no está configurada/);
  });

  it("hides a failure of the model behind a friendly error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const extractor: ReceiptExtractor = {
      extract: vi.fn(async () => {
        throw new ExtractionFailedError("boom");
      }),
    };
    await expect(extractReceiptDrafts(extractor, image)).rejects.toThrow(/No se pudo leer/);
    spy.mockRestore();
  });
});
