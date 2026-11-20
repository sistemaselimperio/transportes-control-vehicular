import { describe, expect, it } from "vitest";
import {
  locationNamesFromNote,
  parseClientImportCsv,
  parseCsv,
  planClientImport,
  type ClientImportRow,
} from "./client-import";

describe("parseCsv", () => {
  it("reads rows and fields, with CRLF or LF and a BOM", () => {
    expect(parseCsv("﻿a,b\r\n1,2\n3,4\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("keeps commas, doubled quotes and line breaks inside quotes", () => {
    expect(parseCsv('name,notes\n"Agro, S.A.","dice ""hola""\nsegunda línea"\n')).toEqual([
      ["name", "notes"],
      ["Agro, S.A.", 'dice "hola"\nsegunda línea'],
    ]);
  });

  it("keeps empty fields and a last row without a final newline", () => {
    expect(parseCsv("a,,c\n,,")).toEqual([
      ["a", "", "c"],
      ["", "", ""],
    ]);
  });
});

describe("locationNamesFromNote", () => {
  it("is one 'Principal' finca without a note or with an unrelated one", () => {
    expect(locationNamesFromNote(null)).toEqual(["Principal"]);
    expect(locationNamesFromNote("paga a 30 días")).toEqual(["Principal"]);
  });

  it("numbers the fincas from 'N fincas'", () => {
    expect(locationNamesFromNote("3 fincas")).toEqual(["Finca 1", "Finca 2", "Finca 3"]);
    expect(locationNamesFromNote("2Fincas en total")).toEqual(["Finca 1", "Finca 2"]);
    expect(locationNamesFromNote("  4 FINCAS")).toHaveLength(4);
  });

  it("knows the two notes that name their fincas, ignoring case, accents and punctuation", () => {
    expect(locationNamesFromNote("2 fincas, portada y zipaquira")).toEqual(["Portada", "Zipaquirá"]);
    expect(locationNamesFromNote("2 Fincas, Portada y Zipaquirá")).toEqual(["Portada", "Zipaquirá"]);
    expect(locationNamesFromNote("2 fincas san migue y caldas")).toEqual(["San Miguel", "Caldas"]);
    expect(locationNamesFromNote("2 FINCAS SAN MIGUE Y CALDAS")).toEqual(["San Miguel", "Caldas"]);
  });

  it("falls back to 'Principal' for a count of zero", () => {
    expect(locationNamesFromNote("0 fincas")).toEqual(["Principal"]);
  });
});

describe("parseClientImportCsv", () => {
  const csv = [
    "name,nit,notes",
    "AGRO  UNO,900.111.222-3,",
    '"GANADERA DOS, S.A.",,"3 fincas, todas en Susa"',
    ",800111222,sin nombre",
    "TOTAL,,",
    "   total ,,",
    'LÁCTEOS TRES,800333444,"2 fincas, portada y zipaquira"',
  ].join("\n");

  it("skips rows without a name and the TOTAL row", () => {
    const rows = parseClientImportCsv(csv);
    expect(rows.map((r) => r.name)).toEqual(["AGRO UNO", "GANADERA DOS, S.A.", "LÁCTEOS TRES"]);
  });

  it("normalizes name, NIT and notes and plans the fincas", () => {
    const [agro, ganadera] = parseClientImportCsv(csv);
    expect(agro).toEqual<ClientImportRow>({
      name: "AGRO UNO",
      nameKey: "agrouno",
      nit: "9001112223",
      notes: null,
      locationNames: ["Principal"],
    });
    expect(ganadera.nit).toBeNull();
    expect(ganadera.notes).toBe("3 fincas, todas en Susa");
    expect(ganadera.locationNames).toEqual(["Finca 1", "Finca 2", "Finca 3"]);
  });

  it("finds the columns by header name, in any order", () => {
    const rows = parseClientImportCsv("Notes,NIT,Name\nhola,123456,Agro\n");
    expect(rows).toEqual([{ name: "Agro", nameKey: "agro", nit: "123456", notes: "hola", locationNames: ["Principal"] }]);
  });

  it("fails when the name column is missing", () => {
    expect(() => parseClientImportCsv("nit,notes\n1,2\n")).toThrow(/name/);
  });
});

describe("planClientImport", () => {
  const row = (over: Partial<ClientImportRow> = {}): ClientImportRow => ({
    name: "Agro Uno",
    nameKey: "agrouno",
    nit: "9001112223",
    notes: null,
    locationNames: ["Principal"],
    ...over,
  });
  const none = { nits: new Set<string>(), nameKeys: new Set<string>() };

  it("inserts new clients and counts their fincas", () => {
    const plan = planClientImport(
      [row(), row({ name: "Dos", nameKey: "dos", nit: null, locationNames: ["Finca 1", "Finca 2"] })],
      none,
    );
    expect(plan.toInsert.map((r) => r.name)).toEqual(["Agro Uno", "Dos"]);
    expect(plan.skipped).toEqual([]);
    expect(plan.locationCount).toBe(3);
  });

  it("skips clients already in the database by NIT or by name", () => {
    const plan = planClientImport(
      [row(), row({ name: "Otro", nameKey: "otro", nit: null })],
      { nits: new Set(["9001112223"]), nameKeys: new Set(["otro"]) },
    );
    expect(plan.toInsert).toEqual([]);
    expect(plan.skipped).toEqual([
      { name: "Agro Uno", reason: "existing-nit" },
      { name: "Otro", reason: "existing-name" },
    ]);
  });

  it("skips repeats inside the file, keeping the first", () => {
    const plan = planClientImport(
      [row(), row({ name: "AGRO  UNO", nit: null }), row({ name: "Otro nombre", nameKey: "otronombre" })],
      none,
    );
    expect(plan.toInsert.map((r) => r.name)).toEqual(["Agro Uno"]);
    expect(plan.skipped).toEqual([
      { name: "AGRO  UNO", reason: "duplicate-name-in-file" },
      { name: "Otro nombre", reason: "duplicate-nit-in-file" },
    ]);
  });

  it("does not treat missing NITs as the same NIT", () => {
    const plan = planClientImport(
      [row({ nit: null }), row({ name: "Dos", nameKey: "dos", nit: null })],
      none,
    );
    expect(plan.toInsert).toHaveLength(2);
  });

  it("skips a name that has no letters or digits", () => {
    const plan = planClientImport([row({ name: "---", nameKey: "" })], none);
    expect(plan.skipped).toEqual([{ name: "---", reason: "invalid-name" }]);
  });
});
