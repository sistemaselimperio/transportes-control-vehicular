import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfLibPages } from "./pdf-lib-pages";

async function samplePdf(pageCount: number) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([100 + i, 100]);
  return Buffer.from(await doc.save());
}

describe("pdfLibPages", () => {
  it("counts the pages", async () => {
    expect(await pdfLibPages.pageCount(await samplePdf(4))).toBe(4);
  });

  it("builds a PDF with only the chosen pages, in order", async () => {
    const picked = await pdfLibPages.pick(await samplePdf(4), [3, 1]);
    const doc = await PDFDocument.load(picked);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getWidth()).toBe(102);
    expect(doc.getPage(1).getWidth()).toBe(100);
  });

  it("rejects bytes that are not a PDF", async () => {
    await expect(pdfLibPages.pageCount(Buffer.from("nope"))).rejects.toThrow();
  });
});
