import { describe, expect, it } from "vitest";
import { buildServiceContextText, serviceExtractionSchema } from "./service-extractor";

describe("buildServiceContextText", () => {
  it("lists plates and providers and says what today is", () => {
    const text = buildServiceContextText({
      plates: ["TRN-084"],
      providers: ["Taller Páez"],
      defaultPlate: null,
      today: "2026-10-17",
    });
    expect(text).toContain("Hoy es 2026-10-17.");
    expect(text).toContain("TRN-084");
    expect(text).toContain("Taller Páez");
    expect(text).not.toContain("no indiquen vehículo");
  });

  it("names the default plate for rows without a vehicle", () => {
    const text = buildServiceContextText({ plates: [], providers: [], defaultPlate: "TRN-084", today: "2026-10-17" });
    expect(text).toContain("no indiquen vehículo son de la placa TRN-084");
  });
});

describe("serviceExtractionSchema", () => {
  const service = {
    date: null,
    plate: null,
    kind: null,
    description: "x",
    provider: null,
    km: null,
    price: 45000,
    notes: null,
  };

  it("accepts a complete answer", () => {
    expect(serviceExtractionSchema.parse({ services: [service] }).services).toHaveLength(1);
  });

  it("refuses a missing field and a fractional price", () => {
    expect(() => serviceExtractionSchema.parse({ services: [{ ...service, notes: undefined }] })).toThrow();
    expect(() => serviceExtractionSchema.parse({ services: [{ ...service, price: 1.5 }] })).toThrow();
  });
});
