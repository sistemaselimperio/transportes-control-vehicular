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

const ok = { category: "SOAT", mimeType: "application/pdf", size: 1000 } as const;

describe("FILE_CATEGORIES", () => {
  it("does not cap how many files a category holds", () => {
    expect(FILE_CATEGORY_KEYS.every((k) => !("limit" in FILE_CATEGORIES[k]))).toBe(true);
  });

  it("has a Spanish label for every category", () => {
    expect(FILE_CATEGORIES.TECNO.label).toBe("Tecnomecánica");
    expect(FILE_CATEGORIES.OWNERSHIP_CARD.label).toBe("T. Propiedad");
    expect(FILE_CATEGORIES.OTHER.label).toBe("Otros");
    expect(FILE_CATEGORY_KEYS).toHaveLength(7);
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
});

describe("formatFileSize", () => {
  it("formats bytes, KB and MB", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(250 * 1024)).toBe("250 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1,5 MB");
  });
});
