import { describe, expect, it } from "vitest";
import { canonicalName, coteroKey, groupByCotero, normalizeDocument } from "./cotero-identity";

describe("canonicalName", () => {
  it("trims and collapses spaces, keeping the casing", () => {
    expect(canonicalName("  Juan   Pérez ")).toBe("Juan Pérez");
  });
});

describe("normalizeDocument", () => {
  it("keeps only the digits", () => {
    expect(normalizeDocument("1.056.507.092")).toBe("1056507092");
    expect(normalizeDocument("C.C. 1056507092")).toBe("1056507092");
  });

  it("is null when blank or too short or long to be a cédula", () => {
    expect(normalizeDocument("")).toBeNull();
    expect(normalizeDocument(null)).toBeNull();
    expect(normalizeDocument("123")).toBeNull();
    expect(normalizeDocument("1234567890123456")).toBeNull();
  });
});

describe("coteroKey", () => {
  it("groups by the cédula when there is one, whatever the name says", () => {
    const a = coteroKey({ name: "Juan Perez", document: "1056507092" });
    const b = coteroKey({ name: "Jhon Peres", document: "1.056.507.092" });
    expect(a).toBe(b);
    expect(a).toBe("doc:1056507092");
  });

  it("falls back to the name without case, accents, spaces or punctuation", () => {
    expect(coteroKey({ name: "Juan  Pérez", document: null })).toBe(coteroKey({ name: "juan perez.", document: "" }));
    expect(coteroKey({ name: "Juan Pérez", document: null })).toBe("name:juanperez");
  });

  it("is null without a cédula or a name", () => {
    expect(coteroKey({ name: "  ", document: null })).toBeNull();
    expect(coteroKey({ name: "", document: "12" })).toBeNull();
  });
});

describe("groupByCotero", () => {
  const rows = [
    { coteroKey: "doc:111111", coteroName: "Juan Perez", coteroDocument: "111111", date: "2026-01-02" },
    { coteroKey: "doc:111111", coteroName: "Jhon Peres", coteroDocument: "111111", date: "2026-02-03" },
    { coteroKey: "name:maria", coteroName: "Maria", coteroDocument: null, date: "2026-01-05" },
  ];

  it("makes one group per key and names it after the most recent receipt", () => {
    const groups = groupByCotero(rows);
    expect(groups).toHaveLength(2);
    const juan = groups.find((g) => g.key === "doc:111111");
    expect(juan?.name).toBe("Jhon Peres");
    expect(juan?.document).toBe("111111");
    expect(juan?.items).toHaveLength(2);
  });

  it("sorts groups by name", () => {
    expect(groupByCotero(rows).map((g) => g.name)).toEqual(["Jhon Peres", "Maria"]);
  });
});
