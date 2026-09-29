import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@clerk/nextjs/server";
import { query } from "@/lib/prisma";

export const runtime = "nodejs";

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Upsert User in Database to satisfy foreign key constraints
    const { currentUser } = await import("@clerk/nextjs/server");
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress || `unknown-${userId}@example.com`;
    await query(`INSERT INTO "User" (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [userId, email]);

    const body = (await req.json()) as {
      chatId?: string;
      question?: string;
      documentChunks?: string[];
    };

    let { chatId, question, documentChunks } = body;

    if (!question?.trim()) {
      return NextResponse.json({ error: "A question is required." }, { status: 400 });
    }

    if (!Array.isArray(documentChunks) || documentChunks.length === 0) {
      return NextResponse.json({ error: "Document context is missing." }, { status: 400 });
    }

    // 2. Database: Create Chat if it doesn't exist
    if (!chatId) {
      chatId = generateUUID();
      const title = question.substring(0, 40) + (question.length > 40 ? "..." : "");
      await query(
        `INSERT INTO "Chat" (id, "userId", title, "createdAt") VALUES ($1, $2, $3, NOW())`,
        [chatId, userId, title]
      );
    }

    // 3. Database: Save User's Message
    const userMsgId = generateUUID();
    await query(
      `INSERT INTO "Message" (id, "chatId", role, content, "createdAt") VALUES ($1, $2, $3, $4, NOW())`,
      [userMsgId, chatId, 'user', question]
    );

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "paste_your_new_key_here") {
      return NextResponse.json({ error: "Gemini API key is not configured." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro-latest", "gemini-3.7-flash", "gemini-3.6-flash"];

    const slicedChunks = documentChunks.slice(0, 60);
    const indexedContext = slicedChunks
      .map((chunk, idx) => {
        const docMatch = chunk.match(/^\[Document: (.*?)\]\n/);
        const docName = docMatch ? docMatch[1] : "Unknown Document";
        const cleanChunk = chunk.replace(/^\[Document: .*?\]\n/, "");
        return `[Document: ${docName}, Chunk ${idx + 1}]\n${cleanChunk}`;
      })
      .join("\n\n---\n\n");

    const prompt = `You are a precise multi-document AI assistant. Your sole job is to answer the user's question based strictly on the document context provided below.

Context format:
Each chunk below starts with [Document: filename, Chunk X].

Rules you must follow:
1. Answer ONLY using information from the provided context. Do not use any external knowledge.
2. If the user asks about a specific document (e.g., "this document", "the new document", "Drashtin's resume", or a specific file name), focus your answer on that specific document.
3. If the user asks a general question (e.g., "what is in these documents?"), synthesize information across all relevant documents and clearly state which document each detail comes from.
4. Identify which Chunk number(s) (e.g., 1, 2) were directly used to answer the question.
5. If the answer is not in the context, say exactly: "I couldn't find that information in the provided document(s)."
6. ALWAYS append exactly "===SOURCES===" on a new line at the very end of your answer, followed immediately by a JSON array of the Chunk numbers you directly used (e.g., [1, 2]). If you didn't use any chunks, output []. Do not include the word "chunk" inside the array, only the numbers.

DOCUMENT CONTEXT:
---
${indexedContext}
---

USER QUESTION: ${question.trim()}

ANSWER:`;

    let streamResult: any = null;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        console.log(`[/api/chat] Requesting streaming answer from '${modelName}'...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        streamResult = await model.generateContentStream(prompt);
        lastError = null;
        break;
      } catch (err: any) {
        lastError = err;
        console.error(`[/api/chat] Error with model '${modelName}':`, err?.message || err);
      }
    }

    if (lastError || !streamResult) {
      return NextResponse.json({ error: "Failed to get a response from the AI. Please try again." }, { status: 500 });
    }

    let fullAIResponse = "";

    // Stream the response back to the client natively
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResult.stream) {
            const textChunk = chunk.text();
            fullAIResponse += textChunk;
            controller.enqueue(new TextEncoder().encode(textChunk));
          }
        } catch (err) {
          console.error("Stream reading error", err);
          controller.error(err);
        } finally {
          // 4. Database: Save AI's Message once stream finishes
          try {
            const aiMsgId = generateUUID();
            await query(
              `INSERT INTO "Message" (id, "chatId", role, content, "createdAt") VALUES ($1, $2, $3, $4, NOW())`,
              [aiMsgId, chatId!, 'ai', fullAIResponse]
            );
            console.log("[/api/chat] Saved AI message to DB successfully.");
          } catch (dbErr) {
            console.error("Failed to save AI message to DB", dbErr);
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Chat-Id": chatId!,
      },
    });
  } catch (err: any) {
    console.error("========== GENERAL /api/chat ERROR ==========");
    console.error(err);
    return NextResponse.json(
      { error: "Failed to process your request. Please try again." },
      { status: 500 }
    );
  }
}
