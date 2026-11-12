/** OpenAI adapter of the invoice extractor: one Responses API call with a structured output. */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  buildContextText,
  EXTRACTION_PROMPT,
  ExtractionFailedError,
  ExtractorNotConfiguredError,
  extractionSchema,
  type InvoiceExtractor,
  type InvoiceFile,
} from "../application/invoice-extractor";

const DEFAULT_MODEL = "gpt-6-astra";

/** The file as the Responses API takes it: a data URL, inline. */
function filePart(file: InvoiceFile) {
  const dataUrl = `data:${file.mimeType};base64,${file.data.toString("base64")}`;
  return file.kind === "pdf"
    ? ({ type: "input_file", filename: file.fileName, file_data: dataUrl } as const)
    : ({ type: "input_image", image_url: dataUrl, detail: "high" } as const);
}

export const openAiInvoiceExtractor: InvoiceExtractor = {
  async extract(file, context) {
    // Read on every call: a key added later works without a rebuild, and a missing one never breaks imports.
    if (!process.env.OPENAI_API_KEY) throw new ExtractorNotConfiguredError("OPENAI_API_KEY is not set.");
    const openai = new OpenAI();
    let response;
    try {
      response = await openai.responses.parse({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        input: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: [filePart(file), { type: "input_text", text: buildContextText(context) }] },
        ],
        text: { format: zodTextFormat(extractionSchema, "petty_cash_expenses") },
      });
    } catch (e) {
      throw new ExtractionFailedError("OpenAI request failed", { cause: e });
    }
    if (!response.output_parsed) throw new ExtractionFailedError("OpenAI returned no parsed output (refusal or incomplete).");
    // The SDK validated the shape already; this keeps the type honest and rejects drift.
    return extractionSchema.parse(response.output_parsed);
  },
};
