import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { query } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

    const body = await req.json();
    const { filename, chunks, existingChatId } = body;

    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return NextResponse.json({ error: "No document chunks provided." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured." }, { status: 500 });
    }

    // Upsert User in Database to satisfy foreign key constraints
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress || `unknown-${userId}@example.com`;
    await query(`INSERT INTO "User" (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [userId, email]);

    // Create Document
    const documentId = generateUUID();
    await query(
      `INSERT INTO "Document" (id, "userId", "fileName", "createdAt") VALUES ($1, $2, $3, NOW())`,
      [documentId, userId, filename || "Untitled Document"]
    );

    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

    console.log(`[/api/vectorize] Generating embeddings for ${chunks.length} chunks...`);

    // Generate embeddings and insert into DB
    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      const result = await embeddingModel.embedContent(content);
      const embedding = result.embedding.values; 
      
      const vectorStr = `[${embedding.join(',')}]`;
      const chunkId = generateUUID();

      await query(
        `INSERT INTO "DocumentChunk" (id, "documentId", "pageNumber", content, embedding, "createdAt") 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [chunkId, documentId, i + 1, content, vectorStr]
      );
    }

    // Create or Link Chat
    let chatId = existingChatId;
    if (!chatId) {
      chatId = generateUUID();
      const title = filename ? `📄 ${filename}` : "New Document Chat";
      await query(
        `INSERT INTO "Chat" (id, "userId", title, "createdAt") VALUES ($1, $2, $3, NOW())`,
        [chatId, userId, title]
      );
    }

    // Link Chat and Document
    await query(
      `INSERT INTO "ChatDocument" ("chatId", "documentId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [chatId, documentId]
    );

    console.log(`[/api/vectorize] Successfully saved ${chunks.length} vectors to DB for document ${documentId}. Linked to chat ${chatId}.`);

    return NextResponse.json({ success: true, chatId, documentId });
  } catch (err: any) {
    console.error("========== /api/vectorize ERROR ==========");
    console.error(err);
    return NextResponse.json(
      { error: "Failed to process and upload document chunks." },
      { status: 500 }
    );
  }
}
