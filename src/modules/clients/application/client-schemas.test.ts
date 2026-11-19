import { describe, expect, it } from "vitest";
import { clientIdSchema, clientSchema } from "./client-schemas";

const valid = { name: "AGROPECUARIA  la esperanza", nit: "900.123.456-7", phone: " 3101234567 ", address: " Vereda La Y ", mapsUrl: "", notes: "" };

describe("clientSchema", () => {
  it("normalizes the name to title case and the NIT to digits", () => {
    const parsed = clientSchema.parse(valid);
    expect(parsed.name).toBe("Agropecuaria la Esperanza");
    expect(parsed.nit).toBe("9001234567");
    expect(parsed.phone).toBe("3101234567");
    expect(parsed.address).toBe("Vereda La Y");
  });

  it("turns blank optional fields into null", () => {
    const parsed = clientSchema.parse({ name: "Juan Perez" });
    expect(parsed).toMatchObject({ nit: null, phone: null, address: null, mapsUrl: null, notes: null, latitude: null, longitude: null });
  });

  it("requires the name", () => {
    const r = clientSchema.safeParse({ ...valid, name: "   " });
    expect(!r.success && r.error.issues[0]?.message).toBe("Ingresa el nombre del cliente.");
  });

  it("rejects a NIT without enough digits", () => {
    const r = clientSchema.safeParse({ ...valid, nit: "12" });
    expect(!r.success && r.error.issues[0]?.message).toBe("Revisa el NIT: debe tener entre 5 y 15 dígitos.");
    expect(clientSchema.safeParse({ ...valid, nit: "abc" }).success).toBe(false);
  });

  it("parses the coordinates out of a full maps link", () => {
    const parsed = clientSchema.parse({ ...valid, mapsUrl: "https://www.google.com/maps/place/X/@5.5353,-73.3678,17z" });
    expect(parsed.latitude).toBe(5.5353);
    expect(parsed.longitude).toBe(-73.3678);
    expect(parsed.mapsUrl).toBe("https://www.google.com/maps/place/X/@5.5353,-73.3678,17z");
  });

  it("keeps a short link as is, with no coordinates", () => {
    const parsed = clientSchema.parse({ ...valid, mapsUrl: "https://maps.app.goo.gl/AbC123" });
    expect(parsed.mapsUrl).toBe("https://maps.app.goo.gl/AbC123");
    expect(parsed.latitude).toBeNull();
    expect(parsed.longitude).toBeNull();
  });

  it("rejects a maps link that is not http(s)", () => {
    const r = clientSchema.safeParse({ ...valid, mapsUrl: "javascript:alert(1)" });
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
