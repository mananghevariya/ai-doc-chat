import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

function extractAnswerByRegex(text: string): string | null {
  const match = text.match(/["']answer["']\s*:\s*"((?:[^"\\]|\\[\s\S])*)"/);
  if (match && match[1]) {
    return match[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\");
  }
  return null;
}

function extractSourcesByRegex(text: string): number[] {
  const match = text.match(/["']sourceChunkIndexes["']\s*:\s*\[([\d\s,]*)]/);
  if (match && match[1]) {
    return match[1]
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
  }
  return [];
}

function parseAiResponse(rawText: string): { answer: string; sourceChunkIndexes: number[] } {
  let cleaned = rawText.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  // Attempt 1: Standard JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed.answer === "string") {
      const sourceChunkIndexes = Array.isArray(parsed.sourceChunkIndexes)
        ? parsed.sourceChunkIndexes
            .map((n: any) => Number(n))
            .filter((n: number) => !isNaN(n) && n > 0)
        : [];
      return { answer: parsed.answer.trim(), sourceChunkIndexes };
    }
  } catch {
    // Proceed to fallback extractions
  }

  // Attempt 2: Regex extraction
  const regexAnswer = extractAnswerByRegex(cleaned);
  const regexSources = extractSourcesByRegex(cleaned);

  if (regexAnswer) {
    return { answer: regexAnswer.trim(), sourceChunkIndexes: regexSources };
  }

  // Attempt 3: If text starts with '{' and contains JSON structure, sanitize
  if (cleaned.startsWith("{") && cleaned.includes("answer")) {
    const sanitized = cleaned
      .replace(/\{?\s*"answer"\s*:\s*"/i, "")
      .replace(/",?\s*"sourceChunkIndexes"\s*:\s*\[[\d\s,]*\]\s*\}?/i, "")
      .replace(/["']?\s*\}?\s*$/i, "")
      .trim();
    if (sanitized) {
      return { answer: sanitized, sourceChunkIndexes: regexSources };
    }
  }

  return { answer: cleaned, sourceChunkIndexes: [] };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      question?: string;
      documentChunks?: string[];
    };

    const { question, documentChunks } = body;

    if (!question?.trim()) {
      return NextResponse.json(
        { error: "A question is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(documentChunks) || documentChunks.length === 0) {
      return NextResponse.json(
        { error: "Document context is missing." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "paste_your_new_key_here") {
      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured. Please set GEMINI_API_KEY in your .env.local file.",
        },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = [
      "gemini-2.5-flash",
      "gemini-3.5-flash",
      "gemini-flash-latest",
      "gemini-2.0-flash",
    ];

    const slicedChunks = documentChunks.slice(0, 50);
    const indexedContext = slicedChunks
      .map((chunk, idx) => `[Chunk ${idx + 1}]\n${chunk}`)
      .join("\n\n---\n\n");

    const prompt = `You are a precise multi-document AI assistant. Your sole job is to answer the user's question based strictly on the document context provided below.

Context format:
Each chunk below starts with [Chunk X] and contains origin tags like [Document: filename.pdf].

Rules you must follow:
1. Answer ONLY using information from the provided context. Do not use any external knowledge.
2. If the user asks about a specific document (e.g., "this document", "the new document", "Drashtin's resume", or a specific file name), focus your answer on that specific document.
3. If the user asks a general question (e.g., "what is in these documents?"), synthesize information across all relevant documents and clearly state which document each detail comes from.
4. Identify which Chunk number(s) (e.g., 1, 2) were directly used to answer the question.
5. If the answer is not in the context, set answer to: "I couldn't find that information in the provided document(s)." and set sourceChunkIndexes to [].
6. Output strictly as JSON matching this schema:
{
  "answer": "Your clear, concise answer...",
  "sourceChunkIndexes": [1, 2]
}

DOCUMENT CONTEXT:
---
${indexedContext}
---

USER QUESTION: ${question.trim()}

JSON RESPONSE:`;

    let rawText = "";
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        console.log(`[/api/chat] Requesting structured answer from '${modelName}'...`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" },
        });
        const result = await model.generateContent(prompt);
        rawText = result.response.text();
        lastError = null;
        break;
      } catch (err: any) {
        lastError = err;
        console.error(`[/api/chat] Error with model '${modelName}':`, err?.message || err);
      }
    }

    if (lastError || !rawText) {
      return NextResponse.json(
        {
          error: "Failed to get a response from the AI. Please try again.",
        },
        { status: 500 }
      );
    }

    const { answer, sourceChunkIndexes } = parseAiResponse(rawText);

    return NextResponse.json({ answer, sourceChunkIndexes });
  } catch (err: any) {
    console.error("========== GENERAL /api/chat ERROR ==========");
    console.error(err);
    return NextResponse.json(
      { error: "Failed to process your request. Please try again." },
      { status: 500 }
    );
  }
}
