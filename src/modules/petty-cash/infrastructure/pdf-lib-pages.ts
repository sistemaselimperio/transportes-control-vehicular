import { PDFDocument } from "pdf-lib";
import type { PdfPages } from "../application/invoice-import";

export const pdfLibPages: PdfPages = {
  async pageCount(data) {
    const doc = await PDFDocument.load(data, { ignoreEncryption: true });
    return doc.getPageCount();
  },

  async pick(data, pages) {
    const source = await PDFDocument.load(data, { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const copied = await out.copyPages(source, pages.map((n) => n - 1));
    copied.forEach((page) => out.addPage(page));
    return Buffer.from(await out.save());
  },
};
