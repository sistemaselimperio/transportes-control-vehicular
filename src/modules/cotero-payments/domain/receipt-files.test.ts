import { describe, expect, it } from "vitest";
import {
  extensionOfMime,
  isProofPath,
  isReceiptFilePath,
  mimeOfPath,
  proofFilePath,
  receiptFilePath,
} from "./receipt-files";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

describe("receiptFilePath", () => {
  it("lives under recibos/YYYY/MM/<uuid>.<ext>", () => {
    expect(receiptFilePath("2026-11-11", UUID, "application/pdf")).toBe(`recibos/2026/11/${UUID}.pdf`);
    expect(receiptFilePath("2026-03-01", UUID, "image/jpeg")).toBe(`recibos/2026/03/${UUID}.jpg`);
  });

  it("is recognized as a receipt file path", () => {
    expect(isReceiptFilePath(receiptFilePath("2026-11-11", UUID, "image/webp"))).toBe(true);
  });
});

describe("proofFilePath", () => {
  it("lives apart from the receipts", () => {
    const path = proofFilePath("2026-11-11", UUID, "image/png");
    expect(path).toBe(`recibos/comprobantes/2026/11/${UUID}.png`);
    expect(isProofPath(path)).toBe(true);
    expect(isReceiptFilePath(path)).toBe(false);
  });
});

describe("isReceiptFilePath", () => {
  it("rejects anything outside the recibos folder or with traversal", () => {
    expect(isReceiptFilePath("vehiculos/ABC123/file.pdf")).toBe(false);
    expect(isReceiptFilePath(`recibos/2026/11/../../x/${UUID}.pdf`)).toBe(false);
    expect(isReceiptFilePath(`recibos/2026/11/${UUID}.exe`)).toBe(false);
    expect(isReceiptFilePath("recibos/2026/11/not-a-uuid.pdf")).toBe(false);
    expect(isReceiptFilePath("")).toBe(false);
  });
});

describe("mime helpers", () => {
  it("maps the allowed types to extensions and back", () => {
    expect(extensionOfMime("application/pdf")).toBe("pdf");
    expect(extensionOfMime("image/png")).toBe("png");
    expect(extensionOfMime("text/plain")).toBeNull();
    expect(mimeOfPath(`recibos/2026/11/${UUID}.jpg`)).toBe("image/jpeg");
    expect(mimeOfPath(`recibos/2026/11/${UUID}.pdf`)).toBe("application/pdf");
    expect(mimeOfPath("x.bin")).toBe("application/octet-stream");
  });
});
