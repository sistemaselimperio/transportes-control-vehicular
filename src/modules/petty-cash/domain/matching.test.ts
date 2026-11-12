import { describe, expect, it } from "vitest";
import { findSupplierNitByName, matchOwner, normalizeText } from "./matching";

describe("normalizeText", () => {
  it("drops accents, case and extra spaces", () => {
    expect(normalizeText("  Papelería   LA Única ")).toBe("papeleria la unica");
  });
});

describe("matchOwner", () => {
  const owners = [
    { id: 1, name: "FABIAN PAEZ" },
    { id: 2, name: "TRANSPORTE IMPERIO" },
  ];

  it("matches a name regardless of case and accents", () => {
    expect(matchOwner("fabián páez", owners)).toEqual({ id: 1, name: "FABIAN PAEZ" });
  });

  it("returns null for free text that is not an owner", () => {
    expect(matchOwner("Valentina Paez", owners)).toBeNull();
    expect(matchOwner("", owners)).toBeNull();
    expect(matchOwner(null, owners)).toBeNull();
  });
});

describe("findSupplierNitByName", () => {
  const suppliers = [
    { nit: "900111", supplierName: "Papelería La Única S.A.S." },
    { nit: "900222", supplierName: "Terpel" },
    { nit: "900333", supplierName: null },
  ];

  it("finds the supplier whose name contains the text, ignoring case and accents", () => {
    expect(findSupplierNitByName("PAPELERIA LA UNICA", suppliers)).toBe("900111");
  });

  it("finds it when the text contains the catalog name", () => {
    expect(findSupplierNitByName("Estación TERPEL del Sur", suppliers)).toBe("900222");
  });

  it("returns null when nothing matches or the text is too short", () => {
    expect(findSupplierNitByName("Ferretería X", suppliers)).toBeNull();
    expect(findSupplierNitByName("la", suppliers)).toBeNull();
    expect(findSupplierNitByName(null, suppliers)).toBeNull();
  });

  it("returns null when several suppliers match", () => {
    const twins = [
      { nit: "1", supplierName: "Terpel Norte" },
      { nit: "2", supplierName: "Terpel Sur" },
    ];
    expect(findSupplierNitByName("Terpel", twins)).toBeNull();
  });
});
