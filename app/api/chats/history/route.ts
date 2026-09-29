import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { query } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all chats for this user, ordered by newest first
    const result = await query(
      `SELECT id, title, "createdAt" FROM "Chat" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [userId]
    );

    return NextResponse.json({ chats: result.rows });
  } catch (err: any) {
    console.error("========== /api/chats/history ERROR ==========");
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch chat history." },
      { status: 500 }
    );
  }
}
