import { describe, expect, it } from "vitest";
import { buildContextText, extractionSchema } from "./invoice-extractor";

describe("buildContextText", () => {
  it("lists the owners and the fleet for the model to match against", () => {
    const text = buildContextText({
      owners: [{ id: 3, name: "FABIAN PAEZ" }],
      fleet: [{ id: 7, plate: "TRN-084" }],
      pageCount: 4,
    });
    expect(text).toContain("El PDF tiene 4 hojas.");
    expect(text).toContain("3: FABIAN PAEZ");
    expect(text).toContain("7: TRN-084");
  });

  it("says a photo is a single sheet", () => {
    expect(buildContextText({ owners: [], fleet: [], pageCount: null })).toContain("foto de una sola hoja");
  });
});

describe("extractionSchema", () => {
  const expense = {
    detail: "Filtro",
    invoiceNumber: null,
    supplierNit: "900123",
    supplierName: null,
    billedTo: null,
    ownerId: null,
    isElectronicInvoice: false,
    vehiclePlate: null,
    vehicleId: null,
    value: 45000,
    pages: [1],
  };

  it("accepts a complete answer", () => {
    expect(extractionSchema.parse({ expenses: [expense], unreadablePages: [3] }).expenses).toHaveLength(1);
  });

  it("refuses a missing field and a non-integer value", () => {
    const incomplete: Partial<typeof expense> = { ...expense };
    delete incomplete.value;
    expect(() => extractionSchema.parse({ expenses: [incomplete], unreadablePages: [] })).toThrow();
    expect(() => extractionSchema.parse({ expenses: [{ ...expense, value: 1.5 }], unreadablePages: [] })).toThrow();
  });
});
