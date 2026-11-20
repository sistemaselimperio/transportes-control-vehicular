import { describe, expect, it } from "vitest";
import { clientIdSchema, clientSchema, locationSchema } from "./client-schemas";

const valid = { name: "AGROPECUARIA  la esperanza", nit: "900.123.456-7", phone: " 3101234567 ", notes: "" };

describe("clientSchema", () => {
  it("collapses the spaces of the name, keeps its casing and derives the key", () => {
    const parsed = clientSchema.parse(valid);
    expect(parsed.name).toBe("AGROPECUARIA la esperanza");
    expect(parsed.nameKey).toBe("agropecuarialaesperanza");
  });

  it("gives the same key to names that differ only in case, accents and spaces", () => {
    const a = clientSchema.parse({ name: "Agro Ñandú" });
    const b = clientSchema.parse({ name: "  AGRO   nandu " });
    expect(a.nameKey).toBe(b.nameKey);
  });

  it("normalizes the NIT to digits and trims the phone", () => {
    const parsed = clientSchema.parse(valid);
    expect(parsed.nit).toBe("9001234567");
    expect(parsed.phone).toBe("3101234567");
  });

  it("turns blank optional fields into null", () => {
    const parsed = clientSchema.parse({ name: "Juan Perez" });
    expect(parsed).toMatchObject({ nit: null, phone: null, notes: null });
  });

  it("does not carry address or maps data any more", () => {
    const parsed = clientSchema.parse({ ...valid, address: "Vereda La Y", mapsUrl: "https://maps.app.goo.gl/x" });
    expect(parsed).not.toHaveProperty("address");
    expect(parsed).not.toHaveProperty("mapsUrl");
    expect(parsed).not.toHaveProperty("latitude");
  });

  it("requires the name", () => {
    const r = clientSchema.safeParse({ ...valid, name: "   " });
    expect(!r.success && r.error.issues[0]?.message).toBe("Ingresa el nombre del cliente.");
  });

  it("rejects a name without letters or digits and one that is too long", () => {
    expect(clientSchema.safeParse({ ...valid, name: "---" }).success).toBe(false);
    const r = clientSchema.safeParse({ ...valid, name: "x".repeat(121) });
    expect(!r.success && r.error.issues[0]?.message).toBe("El nombre del cliente no puede pasar de 120 caracteres.");
  });

  it("rejects a NIT without enough digits", () => {
    const r = clientSchema.safeParse({ ...valid, nit: "12" });
    expect(!r.success && r.error.issues[0]?.message).toBe("Revisa el NIT: debe tener entre 5 y 15 dígitos.");
    expect(clientSchema.safeParse({ ...valid, nit: "abc" }).success).toBe(false);
  });
});

describe("locationSchema", () => {
  const finca = { name: "  Finca   La Y ", address: " Vereda La Y ", mapsUrl: "" };

  it("collapses the name and derives its key", () => {
    const parsed = locationSchema.parse(finca);
    expect(parsed.name).toBe("Finca La Y");
    expect(parsed.nameKey).toBe("fincalay");
    expect(parsed.address).toBe("Vereda La Y");
  });

  it("requires the name", () => {
    const r = locationSchema.safeParse({ ...finca, name: " " });
    expect(!r.success && r.error.issues[0]?.message).toBe("Ingresa el nombre de la finca.");
  });

  it("turns blank optional fields into null", () => {
    expect(locationSchema.parse({ name: "Principal" })).toMatchObject({
      address: null,
      mapsUrl: null,
      latitude: null,
      longitude: null,
    });
  });

  it("parses the coordinates out of a full maps link", () => {
    const parsed = locationSchema.parse({ ...finca, mapsUrl: "https://www.google.com/maps/place/X/@5.5353,-73.3678,17z" });
    expect(parsed.latitude).toBe(5.5353);
    expect(parsed.longitude).toBe(-73.3678);
    expect(parsed.mapsUrl).toBe("https://www.google.com/maps/place/X/@5.5353,-73.3678,17z");
  });

  it("keeps a short link as is, with no coordinates", () => {
    const parsed = locationSchema.parse({ ...finca, mapsUrl: "https://maps.app.goo.gl/AbC123" });
    expect(parsed.mapsUrl).toBe("https://maps.app.goo.gl/AbC123");
    expect(parsed.latitude).toBeNull();
    expect(parsed.longitude).toBeNull();
  });

  it("rejects a maps link that is not http(s)", () => {
    const r = locationSchema.safeParse({ ...finca, mapsUrl: "javascript:alert(1)" });
    expect(!r.success && r.error.issues[0]?.message).toBe("El link de Maps no es válido: debe empezar por http:// o https://.");
  });
});

describe("clientIdSchema", () => {
  it("accepts positive integers only", () => {
    expect(clientIdSchema.safeParse(3).success).toBe(true);
    expect(clientIdSchema.safeParse(0).success).toBe(false);
    expect(clientIdSchema.safeParse(1.5).success).toBe(false);
  });
});
