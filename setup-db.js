import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

async function setupVectorDB() {
  try {
    console.log("Setting up PostgreSQL database schema...");
    
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');

    // Drop everything cleanly to fix schema mismatches
    await pool.query(`DROP TABLE IF EXISTS "DocumentChunk" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "ChatDocument" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "Message" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "Document" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "Chat" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "User" CASCADE;`);

    // 1. User Table
    await pool.query(`
      CREATE TABLE "User" (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL
      );
    `);

    // 2. Chat Table
    await pool.query(`
      CREATE TABLE "Chat" (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "activeModel" TEXT DEFAULT 'gemini-3.8-flash',
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
      );
    `);

    // 3. Message Table
    await pool.query(`
      CREATE TABLE "Message" (
        id TEXT PRIMARY KEY,
        "chatId" TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        "modelUsed" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"(id) ON DELETE CASCADE
      );
    `);

    // 4. Document Table
    await pool.query(`
      CREATE TABLE "Document" (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "fileName" TEXT NOT NULL,
        "fileSize" INTEGER,
        "pageCount" INTEGER,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
      );
    `);

    // 5. ChatDocument (Many-to-Many Bridge)
    await pool.query(`
      CREATE TABLE "ChatDocument" (
        "chatId" TEXT NOT NULL,
        "documentId" TEXT NOT NULL,
        PRIMARY KEY ("chatId", "documentId"),
        CONSTRAINT "ChatDocument_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"(id) ON DELETE CASCADE,
        CONSTRAINT "ChatDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"(id) ON DELETE CASCADE
      );
    `);

    // 6. DocumentChunk (pgvector)
    await pool.query(`
      CREATE TABLE "DocumentChunk" (
        id TEXT PRIMARY KEY,
        "documentId" TEXT NOT NULL,
        "pageNumber" INTEGER NOT NULL,
        "content" TEXT NOT NULL,
        "embedding" vector(3072),
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"(id) ON DELETE CASCADE
      );
    `);

    console.log("✅ Database Schema Setup Complete! (Index skipped for 3072 dims)");
  } catch (error) {
    console.error("❌ Error setting up DB:", error);
  } finally {
    await pool.end();
  }
}

setupVectorDB();
