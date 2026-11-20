/** OpenAI adapter of the service extractor: one Responses API call with a structured output. */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  buildServiceContextText,
  SERVICE_EXTRACTION_PROMPT,
  ServiceExtractionFailedError,
  ServiceExtractorNotConfiguredError,
  serviceExtractionSchema,
  type ServiceExtractor,
  type ServiceFile,
} from "../application/service-extractor";

const DEFAULT_MODEL = "gpt-6-astra";

/** The file as the Responses API takes it: a data URL, inline. */
function filePart(file: ServiceFile) {
  const dataUrl = `data:${file.mimeType};base64,${file.data.toString("base64")}`;
  return file.kind === "pdf"
    ? ({ type: "input_file", filename: file.fileName, file_data: dataUrl } as const)
    : ({ type: "input_image", image_url: dataUrl, detail: "high" } as const);
}

export const openAiServiceExtractor: ServiceExtractor = {
  async extract(file, context) {
    // Read on every call: a key added later works without a rebuild, and a missing one never breaks imports.
    if (!process.env.OPENAI_API_KEY) throw new ServiceExtractorNotConfiguredError("OPENAI_API_KEY is not set.");
    const openai = new OpenAI();
    let response;
    try {
      response = await openai.responses.parse({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        input: [
          { role: "system", content: SERVICE_EXTRACTION_PROMPT },
          { role: "user", content: [filePart(file), { type: "input_text", text: buildServiceContextText(context) }] },
        ],
        text: { format: zodTextFormat(serviceExtractionSchema, "logbook_services") },
      });
    } catch (e) {
      throw new ServiceExtractionFailedError("OpenAI request failed", { cause: e });
    }
    if (!response.output_parsed) throw new ServiceExtractionFailedError("OpenAI returned no parsed output (refusal or incomplete).");
    return serviceExtractionSchema.parse(response.output_parsed);
  },
};
