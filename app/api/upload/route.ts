import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Splits a long string into overlapping chunks for RAG-style context windows.
 * @param text       - Full extracted text
 * @param chunkSize  - Target number of characters per chunk (default 1000)
 * @param overlap    - Number of characters to repeat between adjacent chunks (default 200)
 */
function splitIntoChunks(
  text: string,
  chunkSize = 1000,
  overlap = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    if (end >= text.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(1);
      return NextResponse.json(
        {
          error: `File too large (${sizeMb} MB). Maximum allowed size is 10 MB (approximately 10 pages).`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // pdf-parse v2: class-based API
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

    const text = result.text?.trim();

    if (!text) {
      return NextResponse.json(
        {
          error:
            "No text could be extracted from this PDF. It may be scanned or image-based.",
        },
        { status: 422 }
      );
    }

    const chunks = splitIntoChunks(text);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const pageCount = result.total; // total pages from pdf-parse v2 TextResult

    return NextResponse.json({ chunks, pageCount, wordCount });
  } catch (err: any) {
    console.error("========== UPLOAD ERROR ==========");
    console.error("[/api/upload] Error Message:", err?.message);
    console.error("[/api/upload] Error Name:", err?.name);
    console.error("[/api/upload] Error Stack:", err?.stack);
    console.error("[/api/upload] Full Error Object:", err);
    console.error("==================================");

    return NextResponse.json(
      {
        error: `Failed to process the PDF: ${err?.message || String(err)}`,
        details: String(err?.message || err),
        stack: String(err?.stack || ""),
      },
      { status: 500 }
    );
  }
}
