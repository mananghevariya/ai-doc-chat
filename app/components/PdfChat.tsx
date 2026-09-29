"use client";

import { useState, useEffect } from "react";
import { DocInfo, Message, SavedSession } from "@/app/types";
import UploadZone from "./upload/UploadZone";
import ChatContainer from "./chat/ChatContainer";

const LOCAL_STORAGE_KEY = "AI_DOC_CHAT_SESSION_V1";

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export default function PdfChat() {
  const [docInfo, setDocInfo] = useState<DocInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRestored, setIsRestored] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);

  // 1. Restore from localStorage on initial mount (ONLY docInfo, NOT messages)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          parsed.docInfo &&
          Array.isArray(parsed.docInfo.chunks)
        ) {
          const restoredDocs = parsed.docInfo.documents || [
            {
              id: "doc-1",
              fileName: parsed.docInfo.fileName || "Document.pdf",
              fileSize: parsed.docInfo.fileSize || "1 MB",
              pageCount: parsed.docInfo.pageCount || 1,
              wordCount: parsed.docInfo.wordCount || 500,
              chunks: parsed.docInfo.chunks || [],
            },
          ];

          setDocInfo({
            ...parsed.docInfo,
            documents: restoredDocs,
          });
        } else {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } finally {
      setIsRestored(true);
    }
  }, []);

  // 2. Persist docInfo to localStorage
  useEffect(() => {
    if (!isRestored) return;
    if (docInfo) {
      try {
        const sessionData = { docInfo, updatedAt: Date.now() };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessionData));
      } catch { }
    } else {
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch { }
    }
  }, [docInfo, isRestored]);

  // 3. Upload success handler
  const handleUploadSuccess = (info: DocInfo) => {
    setDocInfo(info);
    const initialMsg: Message = {
      id: uid(),
      role: "assistant",
      content: `I have extracted "${info.fileName}". Ask me any question based on this document.`,
      isNew: false,
    };
    setMessages([initialMsg]);
    setChatId(null);
  };

  // 4. Start New Chat / Reset handler
  const handleReset = () => {
    setMessages([]);
    setChatId(null);
  };

  if (!isRestored) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fa" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", animation: "spin 0.8s linear infinite",
          border: "3px solid #ede9fe", borderTopColor: "#667eea",
          boxShadow: "0 0 16px rgba(102,126,234,0.2)"
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!docInfo) {
    return <UploadZone onUploadSuccess={handleUploadSuccess} />;
  }

  return (
    <ChatContainer
      docInfo={docInfo}
      setDocInfo={setDocInfo}
      messages={messages}
      setMessages={setMessages}
      onReset={handleReset}
      chatId={chatId}
      setChatId={setChatId}
    />
  );
}
