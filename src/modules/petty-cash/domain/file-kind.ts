export type FileKind = { kind: "pdf"; mimeType: "application/pdf" } | { kind: "image"; mimeType: "image/jpeg" | "image/png" | "image/webp" };

/** What a file really is, from its first bytes: the browser-reported type is not trusted. */
export function sniffFileKind(data: Buffer): FileKind | null {
  if (data.subarray(0, 4).toString("latin1") === "%PDF") return { kind: "pdf", mimeType: "application/pdf" };
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { kind: "image", mimeType: "image/jpeg" };
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { kind: "image", mimeType: "image/png" };
  }
  if (data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP") {
    return { kind: "image", mimeType: "image/webp" };
  }
  return null;
}
