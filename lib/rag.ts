// Pure RAG helpers: no network, no DB, no framework imports, so they can be unit-tested
// offline (see tests/rag.test.mjs) without spending Gemini quota.

export const SOURCES_MARKER = "===SOURCES===";
export const SMALL_DOC_CHUNKS = 12; // up to this many chunks => send the whole document
export const TOP_K = 8; // larger documents => top-K chunks by similarity
export const MODEL_TIMEOUT_MS = 8000;

export interface ChunkRow {
  content: string;
  /** 1-based chunk position inside the uploaded document (stored as "pageNumber"). */
  pageNumber: number;
  similarity: number;
}

/** Split text into overlapping chunks. Always terminates, even for odd parameters. */
export function splitIntoChunks(text: string, chunkSize = 1000, overlap = 200): string[] {
  if (!text) return [];
  const size = Math.max(1, Math.floor(chunkSize));
  const step = Math.max(1, size - Math.max(0, Math.floor(overlap)));
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);
    if (end >= text.length) break;
    start += step;
  }
  return chunks;
}

export function shouldSendWholeDocument(totalChunks: number): boolean {
  return totalChunks > 0 && totalChunks <= SMALL_DOC_CHUNKS;
}

/**
 * Format retrieved chunks. Each paragraph is labelled with its REAL chunk number
 * (pageNumber) so that a citation like "[3]" maps back to chunks[3 - 1] in the UI.
 */
export function buildContext(rows: ChunkRow[]): string {
  return rows
    .map(
      (r) =>
        `[Source Paragraph ${r.pageNumber}, Relevance: ${(r.similarity * 100).toFixed(1)}%]\n${r.content}`
    )
    .join("\n\n---\n\n");
}

export function buildPrompt(question: string, context: string): string {
  const q = question.trim();
  if (!context) return q;
  return `You are an advanced AI assistant connected to a document search system.

Rules you must follow:
1. If the user asks a question about the document, answer using ONLY the retrieved document context below. Do not invent details.
2. If the user asks a general question, greeting, or asks you to "summarize" the document, you may synthesize information across the relevant paragraphs and give a helpful response.
3. Identify which Source Paragraph number(s) were directly used to answer the question.
4. If the user asks for specific facts that are genuinely not in the context, say exactly: "I couldn't find that information in the provided document(s)."
5. ALWAYS append exactly "${SOURCES_MARKER}" on a new line at the very end of your answer, followed immediately by a JSON array of the Source Paragraph numbers you directly used (e.g., [1, 2]). If you didn't use any chunks, output []. Do not include the word "chunk" inside the array, only the numbers.

RETRIEVED DOCUMENT CONTEXT:
---
${context}
---

USER QUESTION: ${q}

ANSWER:`;
}

/** Parse the model's trailing source list. Never throws; returns [] for garbage. */
export function parseSources(raw: string): number[] {
  if (!raw) return [];
  const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  const match = clean.match(/\[([\d\s,]*)\]/);
  if (!match) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const part of match[1].split(",")) {
    const n = parseInt(part.trim(), 10);
    if (Number.isInteger(n) && n > 0 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export function splitAnswerAndSources(full: string): { answer: string; sources: number[] } {
  const idx = full.indexOf(SOURCES_MARKER);
  if (idx === -1) return { answer: full.trim(), sources: [] };
  return {
    answer: full.slice(0, idx).trim(),
    sources: parseSources(full.slice(idx + SOURCES_MARKER.length)),
  };
}

/** Requested model first, then fast, currently-working fallbacks (retired/quota-limited ones removed). */
export function getModelOrder(requested?: string | null): string[] {
  const order = [
    requested || "gemini-3.8-flash",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.7-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
  ];
  return [...new Set(order)];
}

/** Try each model in order with a per-model timeout; return the first that succeeds. */
export async function generateWithFallback<T>(
  models: string[],
  attempt: (model: string) => Promise<T>,
  timeoutMs: number = MODEL_TIMEOUT_MS,
  onError?: (model: string, err: unknown) => void
): Promise<{ result: T; model: string } | null> {
  for (const model of models) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        attempt(model),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
      return { result, model };
    } catch (err) {
      onError?.(model, err);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return null;
}
