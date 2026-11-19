import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth, currentUser } from "@clerk/nextjs/server";
import { query } from "@/lib/prisma";
import {
  TOP_K,
  buildContext,
  buildPrompt,
  generateWithFallback,
  getModelOrder,
  shouldSendWholeDocument,
  MODEL_TIMEOUT_MS,
} from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const body = await req.json();
    const { chatId, question, model } = body;

    if (!question?.trim()) {
      return NextResponse.json({ error: "A question is required." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured." }, { status: 500 });
    }

    // Upsert User (Safety)
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress || `unknown-${userId}@example.com`;
    await query(`INSERT INTO "User" (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [userId, email]);

    let activeChatId = chatId;

    // If no chatId, this is a brand new regular chat
    if (!activeChatId) {
      activeChatId = generateUUID();
      const title = question.slice(0, 30) + (question.length > 30 ? "..." : "");
      await query(
        `INSERT INTO "Chat" (id, title, "userId", "activeModel", "createdAt") VALUES ($1, $2, $3, $4, NOW())`,
        [activeChatId, title, userId, model || 'gemini-3.8-flash']
      );
    }

    // A chat started with "New Chat" has a placeholder title; name it after the first question.
    if (chatId) {
      await query(
        `UPDATE "Chat" SET title = $1 WHERE id = $2 AND "userId" = $3 AND title = 'New chat'`,
        [question.slice(0, 30) + (question.length > 30 ? "..." : ""), activeChatId, userId]
      );
    }

    // 1. Database: Save User's Message
    const userMsgId = generateUUID();
    await query(
      `INSERT INTO "Message" (id, "chatId", role, content, "modelUsed", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userMsgId, activeChatId, 'user', question, null]
    );

    const genAI = new GoogleGenerativeAI(apiKey);
    let indexedContext = "";

    // 2. Vector Similarity Search (RAG) - ONLY IF CHAT HAS DOCUMENTS
    const docsResult = await query(
      `SELECT "documentId" FROM "ChatDocument" WHERE "chatId" = $1`,
      [activeChatId]
    );

    if (docsResult.rows.length > 0) {
      console.log(`[/api/chat] Chat has ${docsResult.rows.length} documents. Embedding question for search...`);
      const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
      const qEmbedResult = await embeddingModel.embedContent(question);
      const qVector = `[${qEmbedResult.embedding.values.join(',')}]`;

      const documentIds = docsResult.rows.map(r => r.documentId);
      
      // Small documents (e.g. a resume): send ALL chunks in reading order so the model
      // sees the whole document. Larger ones: top-8 chunks by vector similarity.
      const countResult = await query(
        `SELECT COUNT(*)::int AS n FROM "DocumentChunk" WHERE "documentId" = ANY($1::text[])`,
        [documentIds]
      );
      const totalChunks: number = countResult.rows[0]?.n ?? 0;

      const searchResult =
        shouldSendWholeDocument(totalChunks)
          ? await query(`
              SELECT content, "pageNumber",
                     1 - (embedding <=> $1::vector) as similarity
              FROM "DocumentChunk"
              WHERE "documentId" = ANY($2::text[])
              ORDER BY "documentId", "pageNumber";
            `, [qVector, documentIds])
          : await query(`
              SELECT content, "pageNumber",
                     1 - (embedding <=> $1::vector) as similarity
              FROM "DocumentChunk"
              WHERE "documentId" = ANY($2::text[])
              ORDER BY embedding <=> $1::vector
              LIMIT ${TOP_K};
            `, [qVector, documentIds]);

      const relevantChunks = searchResult.rows;

      if (relevantChunks.length > 0) {
        // Paragraphs are labelled with their real chunk number (pageNumber), so the
        // citations the model returns match the chunks the UI shows.
        indexedContext = buildContext(relevantChunks);
      }
    }

    // 3. Prepare the Prompt
    const prompt = buildPrompt(question, indexedContext);

    // 4. Pick a model: the user's choice first, then fast fallbacks, each with a timeout
    const attemptResult = await generateWithFallback(
      getModelOrder(model),
      (modelName) => {
        console.log(`[/api/chat] Requesting streaming answer from '${modelName}'...`);
        return genAI.getGenerativeModel({ model: modelName }).generateContentStream(prompt);
      },
      MODEL_TIMEOUT_MS,
      (modelName, err: any) => console.error(`[/api/chat] Error with model '${modelName}':`, err?.message || err)
    );

    const streamResult: any = attemptResult?.result ?? null;
    const successfulModelName = attemptResult?.model ?? "";

    if (!streamResult) {
      return NextResponse.json({ error: "Failed to get a response from the AI." }, { status: 500 });
    }

    // 4. Send True SSE (Server-Sent Events) Stream
    const encoder = new TextEncoder();
    let fullAIResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        // Send the Chat ID first so the frontend knows what the active chat is
        controller.enqueue(encoder.encode(`data: {"chatId": "${activeChatId}"}\n\n`));

        try {
          for await (const chunk of streamResult.stream) {
            const textChunk = chunk.text();
            fullAIResponse += textChunk;
            // Send each chunk properly formatted for SSE
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: textChunk })}\n\n`));
          }
        } catch (err) {
          console.error("Stream reading error", err);
          controller.enqueue(encoder.encode(`data: {"error": "Stream interrupted"}\n\n`));
        } finally {
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
          
          // Save AI Message to DB in background
          try {
            const aiMsgId = generateUUID();
            await query(
              `INSERT INTO "Message" (id, "chatId", role, content, "modelUsed", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())`,
              [aiMsgId, activeChatId, 'ai', fullAIResponse, successfulModelName]
            );
            console.log("[/api/chat] Saved AI message to DB successfully.");
          } catch (dbErr) {
            console.error("Failed to save AI message to DB", dbErr);
          }
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Chat-Id": activeChatId,
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
