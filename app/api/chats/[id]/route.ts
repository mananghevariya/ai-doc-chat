import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { query } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: chatId } = await params;

    // Verify the chat belongs to the user
    const chatResult = await query(
      `SELECT * FROM "Chat" WHERE id = $1`,
      [chatId]
    );

    if (chatResult.rowCount === 0) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const chat = chatResult.rows[0];

    if (chat.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch messages for this chat
    const msgResult = await query(
      `SELECT id, role, content, "createdAt" FROM "Message" WHERE "chatId" = $1 ORDER BY "createdAt" ASC`,
      [chatId]
    );

    return NextResponse.json({ chat, messages: msgResult.rows });
  } catch (err: any) {
    console.error(`========== /api/chats/${params.id} ERROR ==========`);
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch chat details." },
      { status: 500 }
    );
  }
}
