import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth, currentUser } from "@clerk/nextjs/server";
import { query } from "@/lib/prisma";

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
      
      const searchResult = await query(`
        SELECT content, "pageNumber",
               1 - (embedding <=> $1::vector) as similarity
        FROM "DocumentChunk"
        WHERE "documentId" = ANY($2::text[])
        ORDER BY embedding <=> $1::vector
        LIMIT 5;
      `, [qVector, documentIds]);

      const relevantChunks = searchResult.rows;

      if (relevantChunks.length > 0) {
        indexedContext = relevantChunks
          .map((row, idx) => `[Source Paragraph ${idx + 1}, Relevance: ${(row.similarity * 100).toFixed(1)}%]\n${row.content}`)
          .join("\n\n---\n\n");
      }
    }

    // 3. Prepare the Prompt
    let prompt = question;
    if (indexedContext) {
      prompt = `You are an advanced AI assistant connected to a document search system.

Rules you must follow:
1. If the user asks a question about the document, answer using ONLY the retrieved document context below. Do not invent details.
2. If the user asks a general question, greeting, or asks you to "summarize" the document, you may synthesize information across the relevant paragraphs and give a helpful response.
3. Identify which Source Paragraph number(s) were directly used to answer the question.
4. If the user asks for specific facts that are genuinely not in the context, say exactly: "I couldn't find that information in the provided document(s)."
5. ALWAYS append exactly "===SOURCES===" on a new line at the very end of your answer, followed immediately by a JSON array of the Source Paragraph numbers you directly used (e.g., [1, 2]). If you didn't use any chunks, output []. Do not include the word "chunk" inside the array, only the numbers.

RETRIEVED DOCUMENT CONTEXT:
---
${indexedContext}
---

USER QUESTION: ${question.trim()}

ANSWER:`;
    }

    const requestedModel = model || "gemini-3.8-flash";
    const candidateModels = [requestedModel, "gemini-3.8-flash", "gemini-3.7-flash", "gemini-2.5-flash", "gemini-pro-latest"];
    const uniqueModels = [...new Set(candidateModels)];
    
    let streamResult: any = null;
    let successfulModelName = "";

    for (const modelName of uniqueModels) {
      try {
        console.log(`[/api/chat] Requesting streaming answer from '${modelName}'...`);
        const generativeModel = genAI.getGenerativeModel({ model: modelName });
        streamResult = await generativeModel.generateContentStream(prompt);
        successfulModelName = modelName;
        break;
      } catch (err: any) {
        console.error(`[/api/chat] Error with model '${modelName}':`, err?.message || err);
      }
    }

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
