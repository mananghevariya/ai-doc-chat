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

  const [isVectorizing, setIsVectorizing] = useState(false);
  const [vectorizeError, setVectorizeError] = useState<string | null>(null);

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

  // 3. Upload success handler (Vectorize before chatting)
  const handleUploadSuccess = async (info: DocInfo) => {
    setIsVectorizing(true);
    setVectorizeError(null);
    try {
      const res = await fetch("/api/vectorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: info.fileName,
          chunks: info.chunks,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to vectorize document.");
      }

      setDocInfo(info);
      setChatId(data.chatId);
      
      const initialMsg: Message = {
        id: uid(),
        role: "assistant",
        content: `I have extracted "${info.fileName}" and securely stored it for fast AI retrieval. Ask me any question based on this document.`,
        isNew: false,
      };
      setMessages([initialMsg]);
    } catch (err: any) {
      setVectorizeError(err.message || "An error occurred.");
    } finally {
      setIsVectorizing(false);
    }
  };

  // 4. Start New Chat / Reset handler
  const handleReset = () => {
    setDocInfo(null);
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

  if (isVectorizing) {
    return (
      <div className="min-h-screen bg-background relative flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6 shadow-lg"></div>
        <h2 className="text-display text-on-surface font-display mb-2">Analyzing your document...</h2>
        <p className="text-body-lg text-on-surface-variant max-w-md text-center">
          We are converting your PDF text into mathematical vectors for instant AI retrieval. This takes a few seconds.
        </p>
      </div>
    );
  }

  if (vectorizeError) {
    return (
      <div className="min-h-screen bg-background relative flex flex-col items-center justify-center p-4">
        <div className="text-error mb-4"><span className="material-symbols-outlined text-[48px]">error</span></div>
        <h2 className="text-display text-on-surface font-display mb-2">Vectorization Failed</h2>
        <p className="text-body-lg text-error max-w-md text-center mb-6">{vectorizeError}</p>
        <button onClick={() => setVectorizeError(null)} className="px-6 py-2 bg-primary text-on-primary rounded-full font-label-md">Try Again</button>
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
