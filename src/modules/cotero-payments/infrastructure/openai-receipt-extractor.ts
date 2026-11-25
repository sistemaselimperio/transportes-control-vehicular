/** OpenAI adapter of the receipt extractor: one Responses API call over one page image, with a structured output. */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  EXTRACTION_PROMPT,
  ExtractionFailedError,
  ExtractorNotConfiguredError,
  extractionSchema,
  type ReceiptExtractor,
} from "../application/receipt-extractor";

const DEFAULT_MODEL = "gpt-6-astra";

export const openAiReceiptExtractor: ReceiptExtractor = {
  async extract(image) {
    // Read on every call: a key added later works without a rebuild, and a missing one never breaks the page.
    if (!process.env.OPENAI_API_KEY) throw new ExtractorNotConfiguredError("OPENAI_API_KEY is not set.");
    const openai = new OpenAI();
    const dataUrl = `data:${image.mimeType};base64,${image.data.toString("base64")}`;
    let response;
    try {
      response = await openai.responses.parse({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        input: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: [
              { type: "input_image", image_url: dataUrl, detail: "high" },
              { type: "input_text", text: "Extrae los recibos de esta hoja." },
            ],
          },
        ],
        text: { format: zodTextFormat(extractionSchema, "cotero_receipts") },
      });
    } catch (e) {
      throw new ExtractionFailedError("OpenAI request failed", { cause: e });
    }
    if (!response.output_parsed) throw new ExtractionFailedError("OpenAI returned no parsed output (refusal or incomplete).");
    // The SDK validated the shape already; this keeps the type honest and rejects drift.
    return extractionSchema.parse(response.output_parsed);
  },
};
