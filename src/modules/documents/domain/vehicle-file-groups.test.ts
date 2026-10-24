import { describe, expect, it } from "vitest";
import { FILE_GROUPS, fileKindLabel } from "./vehicle-file-groups";
import { FILE_CATEGORY_KEYS } from "./vehicle-file-rules";

describe("FILE_GROUPS", () => {
  it("places every shown category in exactly one group and hides logbooks", () => {
    const placed = FILE_GROUPS.flatMap((g) => g.categories);
    const shown = FILE_CATEGORY_KEYS.filter((c) => c !== "LOGBOOK");
    expect([...placed].sort()).toEqual([...shown].sort());
  });
});

describe("fileKindLabel", () => {
  it("names PDFs and images by extension, ignoring case", () => {
    expect(fileKindLabel("soat.PDF")).toBe("PDF");
    expect(fileKindLabel("foto.jpeg")).toBe("Imagen");
    expect(fileKindLabel("scan.webp")).toBe("Imagen");
  });

  it("falls back for unknown or missing extensions", () => {
    expect(fileKindLabel("notas")).toBe("Archivo");
    expect(fileKindLabel("a.zip")).toBe("Archivo");
  });
});
