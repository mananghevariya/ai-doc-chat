import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { query } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEW_CHAT_TITLE = "New chat";

/**
 * Start a fresh, empty chat that reuses the documents of an existing chat, so the
 * user can ask new questions about the same PDF(s) without uploading them again.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fromChatId } = await req.json();
    if (!fromChatId || typeof fromChatId !== "string") {
      return NextResponse.json({ error: "fromChatId is required." }, { status: 400 });
    }

    // The source chat must belong to the signed-in user.
    const owned = await query(`SELECT id FROM "Chat" WHERE id = $1 AND "userId" = $2`, [
      fromChatId,
      userId,
    ]);
    if (owned.rows.length === 0) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }

    const docs = await query(`SELECT "documentId" FROM "ChatDocument" WHERE "chatId" = $1`, [
      fromChatId,
    ]);
    if (docs.rows.length === 0) {
      return NextResponse.json({ error: "This chat has no documents to reuse." }, { status: 409 });
    }

    const chatId = randomUUID();
    await query(`INSERT INTO "Chat" (id, title, "userId", "createdAt") VALUES ($1, $2, $3, NOW())`, [
      chatId,
      NEW_CHAT_TITLE,
      userId,
    ]);
    for (const row of docs.rows) {
      await query(
        `INSERT INTO "ChatDocument" ("chatId", "documentId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [chatId, row.documentId]
      );
    }

    return NextResponse.json({
      chatId,
      title: NEW_CHAT_TITLE,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("========== /api/chats/new ERROR ==========");
    console.error(err);
    return NextResponse.json({ error: "Failed to start a new chat." }, { status: 500 });
  }
}
