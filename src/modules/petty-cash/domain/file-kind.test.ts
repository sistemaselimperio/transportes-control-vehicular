import { describe, expect, it } from "vitest";
import { sniffFileKind } from "./file-kind";

const bytes = (...b: number[]) => Buffer.from(b);

describe("sniffFileKind", () => {
  it("recognizes a PDF", () => {
    expect(sniffFileKind(Buffer.from("%PDF-1.7\n..."))).toEqual({ kind: "pdf", mimeType: "application/pdf" });
  });

  it("recognizes JPEG, PNG and WebP images", () => {
    expect(sniffFileKind(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toEqual({ kind: "image", mimeType: "image/jpeg" });
    expect(sniffFileKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toEqual({ kind: "image", mimeType: "image/png" });
    expect(sniffFileKind(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toEqual({ kind: "image", mimeType: "image/webp" });
  });

  it("returns null for anything else", () => {
    expect(sniffFileKind(Buffer.from("hello world"))).toBeNull();
    expect(sniffFileKind(Buffer.alloc(0))).toBeNull();
  });
});
