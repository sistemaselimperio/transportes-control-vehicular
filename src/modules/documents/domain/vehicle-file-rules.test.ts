import { describe, expect, it } from "vitest";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import {
  ALLOWED_MIME,
  FILE_CATEGORIES,
  FILE_CATEGORY_KEYS,
  MAX_FILE_BYTES,
  assertCanUpload,
  formatFileSize,
} from "./vehicle-file-rules";

const ok = { category: "SOAT", mimeType: "application/pdf", size: 1000, currentCount: 0 } as const;

describe("FILE_CATEGORIES", () => {
  it("allows 3 files per category and 1 for the ownership card", () => {
    expect(FILE_CATEGORIES.SOAT.limit).toBe(3);
    expect(FILE_CATEGORIES.POLICY.limit).toBe(3);
    expect(FILE_CATEGORIES.OWNERSHIP_CARD.limit).toBe(1);
  });

  it("has a Spanish label for every category", () => {
    expect(FILE_CATEGORIES.TECNO.label).toBe("Tecnomecánica");
    expect(FILE_CATEGORIES.OWNERSHIP_CARD.label).toBe("Tarjeta de propiedad");
    expect(FILE_CATEGORY_KEYS).toHaveLength(6);
  });
});

describe("assertCanUpload", () => {
  it("accepts a valid file", () => {
    expect(() => assertCanUpload(ok)).not.toThrow();
  });

  it("accepts every allowed mime type", () => {
    for (const mimeType of ALLOWED_MIME) {
      expect(() => assertCanUpload({ ...ok, mimeType })).not.toThrow();
    }
  });

  it("rejects a mime type that is not allowed", () => {
    const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    expect(() => assertCanUpload({ ...ok, mimeType: docx })).toThrow(RuleError);
  });

  it("rejects an empty file", () => {
    expect(() => assertCanUpload({ ...ok, size: 0 })).toThrow(RuleError);
  });

  it("accepts exactly the size limit and rejects one byte more", () => {
    expect(() => assertCanUpload({ ...ok, size: MAX_FILE_BYTES })).not.toThrow();
    expect(() => assertCanUpload({ ...ok, size: MAX_FILE_BYTES + 1 })).toThrow(RuleError);
  });

  it("rejects when the category is full, without rotating", () => {
    expect(() => assertCanUpload({ ...ok, currentCount: 2 })).not.toThrow();
    expect(() => assertCanUpload({ ...ok, currentCount: 3 })).toThrow(/Elimina/);
  });

  it("rejects a second ownership card", () => {
    const card = { ...ok, category: "OWNERSHIP_CARD" } as const;
    expect(() => assertCanUpload({ ...card, currentCount: 0 })).not.toThrow();
    expect(() => assertCanUpload({ ...card, currentCount: 1 })).toThrow(RuleError);
  });
});

describe("formatFileSize", () => {
  it("formats bytes, KB and MB", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(250 * 1024)).toBe("250 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1,5 MB");
  });
});
