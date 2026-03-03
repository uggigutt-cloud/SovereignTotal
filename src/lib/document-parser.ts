/**
 * document-parser.ts
 * Extracts plain text from Norwegian legal documents (PDF, DOCX, images/screenshots).
 * Used by the ingest API before sending content to Gemini for structured extraction.
 */

import { getGeminiClient } from "@/core/ai/gemini-client";

export interface ParsedDocument {
  text: string;
  pageCount: number;
  language: string;
  method: "native-pdf" | "ocr-pdf" | "docx" | "image-ocr" | "plain-text";
}

/**
 * Extract text from a file buffer based on its MIME type.
 * For scanned PDFs and images, falls back to Gemini Vision OCR.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename?: string
): Promise<ParsedDocument> {
  const mime = mimeType.toLowerCase();

  if (mime === "application/pdf") {
    return parsePdf(buffer);
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword" ||
    filename?.toLowerCase().endsWith(".docx") ||
    filename?.toLowerCase().endsWith(".doc")
  ) {
    return parseDocx(buffer);
  }

  if (mime.startsWith("image/")) {
    return parseImageWithGemini(buffer, mime);
  }

  if (mime === "text/plain" || mime.startsWith("text/")) {
    return {
      text: buffer.toString("utf-8"),
      pageCount: 1,
      language: "nb",
      method: "plain-text",
    };
  }

  // Unknown type: try as plain text
  return {
    text: buffer.toString("utf-8").slice(0, 50000),
    pageCount: 1,
    language: "nb",
    method: "plain-text",
  };
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  try {
    // Dynamic import avoids bundling pdf-parse in client-side chunks
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? "";

    if (text.length > 100) {
      return {
        text,
        pageCount: result.numpages ?? 1,
        language: "nb",
        method: "native-pdf",
      };
    }

    // Text is empty or very short — likely a scanned/image PDF. Use Gemini Vision.
    return parseImageWithGemini(buffer, "application/pdf");
  } catch {
    // pdf-parse failed — fall back to Gemini Vision
    return parseImageWithGemini(buffer, "application/pdf");
  }
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value?.trim() ?? "",
    pageCount: 1,
    language: "nb",
    method: "docx",
  };
}

async function parseImageWithGemini(
  buffer: Buffer,
  mimeType: string
): Promise<ParsedDocument> {
  const ai = getGeminiClient();
  const base64 = buffer.toString("base64");

  // Supported inline data types for Gemini Vision
  const supportedMime = mimeType === "application/pdf" ? "application/pdf" : mimeType;

  const response = await ai.models.generateContent({
    model: "gemini-1.5-pro",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: supportedMime,
              data: base64,
            },
          },
          {
            text: "Transkriber alt tekst i dette dokumentet nøyaktig slik det er. Bevar all tekst, datoer, navn og juridiske referanser. Svar kun med den transkriberte teksten, uten kommentarer.",
          },
        ],
      },
    ],
  });

  return {
    text: response.text?.trim() ?? "",
    pageCount: 1,
    language: "nb",
    method: mimeType === "application/pdf" ? "ocr-pdf" : "image-ocr",
  };
}
