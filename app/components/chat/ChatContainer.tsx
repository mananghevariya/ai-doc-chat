"use client";

import React, { useState, useRef, useEffect, FormEvent } from "react";
import { ActiveSource, DocInfo, DocumentItem, Message, ChatResponse } from "@/app/types";
import { BotIcon, SendIcon, PdfBadgeIcon } from "../ui/Icons";
import { SpinnerTeal, ErrorBanner, TypingDots } from "../ui/Feedback";
import MessageBubble from "./MessageBubble";

interface ChatContainerProps {
  docInfo: DocInfo;
  setDocInfo: React.Dispatch<React.SetStateAction<DocInfo | null>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onReset: () => void;
}

function uid() { return Math.random().toString(36).slice(2, 9); }
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const QUICK_PROMPTS = [
  { emoji: "📝", label: "Summarize" },
  { emoji: "💡", label: "Key takeaways" },
  { emoji: "🔍", label: "Important details" },
  { emoji: "❓", label: "Main topics" },
];

export default function ChatContainer({
  docInfo, setDocInfo, messages, setMessages, onReset,
}: ChatContainerProps) {
  const [inputValue, setInputValue] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [addingDoc, setAddingDoc] = useState(false);
  const [addDocError, setAddDocError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<ActiveSource | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addDocInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  useEffect(() => {
    const el = scrollAreaRef.current;
    const c = messagesContainerRef.current;
    if (!el || !c) return;
    let near = true;
    const onScroll = () => { near = el.scrollHeight - el.scrollTop - el.clientHeight <= 120; };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => { if (near) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); });
    ro.observe(c);
    return () => { el.removeEventListener("scroll", onScroll); ro.disconnect(); };
  }, []);

  const sendQuestion = async (q: string) => {
    const question = q.trim();
    if (!question || chatLoading || addingDoc) return;
    setInputValue(""); setChatError(null);
    setMessages((p) => [...p, { id: uid(), role: "user", content: question }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, documentChunks: docInfo.chunks }),
      });
      const json: ChatResponse = await res.json();
      if (!res.ok) { setChatError(json.error ?? "Failed to generate a response."); return; }
      setMessages((p) => [...p, { id: uid(), role: "assistant", content: json.answer, sourceChunkIndexes: json.sourceChunkIndexes, isNew: true }]);
    } catch { setChatError("Network error. Please try again."); }
    finally { setChatLoading(false); setTimeout(() => inputRef.current?.focus(), 60); }
  };

  const handleSend = (e: FormEvent) => { e.preventDefault(); sendQuestion(inputValue); };

  const handleAddDocumentFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
    if (file.type !== "application/pdf") { setAddDocError("Only PDF files are supported."); return; }
    if (file.size > 10 * 1024 * 1024) { setAddDocError("File size exceeds 10 MB."); return; }
    setAddDocError(null); setAddingDoc(true);
    const fd = new FormData(); fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setAddDocError(json.error ?? "Upload failed."); return; }
      const tagged = json.chunks.map((c: string) => `[Document: ${file.name}]\n${c}`);
      const newDoc: DocumentItem = { id: uid(), fileName: file.name, fileSize: formatBytes(file.size), pageCount: json.pageCount, wordCount: json.wordCount, chunks: tagged };
      const existing = docInfo.documents?.length ? docInfo.documents : [{ id: uid(), fileName: docInfo.fileName, fileSize: docInfo.fileSize || "1 MB", pageCount: docInfo.pageCount, wordCount: docInfo.wordCount, chunks: docInfo.chunks }];
      const updatedDocs = [...existing, newDoc];
      setDocInfo({ documents: updatedDocs, chunks: [...docInfo.chunks, ...tagged], pageCount: docInfo.pageCount + json.pageCount, wordCount: docInfo.wordCount + json.wordCount, fileName: `${updatedDocs.length} Documents`, fileSize: docInfo.fileSize });
      setMessages((p) => [...p, { id: uid(), role: "assistant", content: `📄 Added **"${file.name}"** — ${json.pageCount} page${json.pageCount !== 1 ? "s" : ""}, ~${json.wordCount.toLocaleString()} words. Now searching across **${updatedDocs.length}** documents.`, isNew: true }]);
    } catch { setAddDocError("Network error while uploading."); }
    finally { setAddingDoc(false); }
  };

  const handleRemoveDoc = (docId: string) => {
    const docs = docInfo.documents || [];
    if (docs.length <= 1) { onReset(); return; }
    const updated = docs.filter((d) => d.id !== docId);
    const removed = docs.find((d) => d.id === docId);
    setDocInfo({ documents: updated, chunks: updated.flatMap((d) => d.chunks), pageCount: updated.reduce((a, d) => a + d.pageCount, 0), wordCount: updated.reduce((a, d) => a + d.wordCount, 0), fileName: `${updated.length} Documents`, fileSize: updated[0]?.fileSize || "1 MB" });
    if (removed) setMessages((p) => [...p, { id: uid(), role: "assistant", content: `🗑️ Removed **"${removed.fileName}"**. ${updated.length} document${updated.length !== 1 ? "s" : ""} remaining.`, isNew: true }]);
  };

  const handleExportChat = () => {
    if (!messages.length) return;
    let c = `# Chat Export — ${new Date().toLocaleString()}\n\n`;
    messages.forEach((m) => { c += `### ${m.role === "user" ? "👤 You" : "🤖 AI"}\n${m.content}\n\n`; });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([c], { type: "text/markdown" })), download: `chat-${Date.now()}.md` });
    a.click();
  };

  const currentDocs = docInfo.documents?.length ? docInfo.documents : [{ id: "doc-1", fileName: docInfo.fileName, fileSize: docInfo.fileSize || "1 MB", pageCount: docInfo.pageCount, wordCount: docInfo.wordCount, chunks: docInfo.chunks }];
  const canSend = !!inputValue.trim() && !chatLoading && !addingDoc;

  return (
    <div className="app-shell">

      {/* ════════════════════════════════
          BEAUTIFUL HEADER
      ════════════════════════════════ */}
      <header className="app-header">

        {/* Left: Brand */}
        <div className="header-brand">
          <div className="header-logo">
            <BotIcon className="w-4 h-4" style={{ color: "white" }} />
          </div>
          <div>
            <div className="header-brand-name">DocChat AI</div>
            <div className="header-brand-sub">Powered by Gemini</div>
          </div>
        </div>

        {/* Center: Doc pills */}
        <div className="header-docs">
          {currentDocs.map((doc, idx) => (
            <span key={doc.id || idx} className="header-doc-pill" title={doc.fileName}>
              <span className="header-doc-pill-icon">
                <PdfBadgeIcon className="w-2.5 h-2.5" style={{ color: "white" }} />
              </span>
              <span className="header-doc-name">{doc.fileName}</span>
              <button className="header-doc-remove" onClick={() => handleRemoveDoc(doc.id)} title="Remove">×</button>
            </span>
          ))}
        </div>

        {/* Right: Actions */}
        <div className="header-actions">
          <button id="add-doc-btn" className="header-btn accent" disabled={addingDoc} onClick={() => addDocInputRef.current?.click()}>
            {addingDoc ? <SpinnerTeal size="sm" /> : (
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            )}
            <span>{addingDoc ? "Adding…" : "+ PDF"}</span>
          </button>

          <input ref={addDocInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleAddDocumentFile} />

          <button className="header-btn" onClick={handleExportChat} disabled={messages.length === 0}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export</span>
          </button>

          <button id="upload-new-btn" className="header-btn" onClick={onReset}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m0 14v1m8-8h-1M5 12H4m13.657-6.343l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707" />
            </svg>
            <span>New</span>
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stats-item">
          <div className="stats-dot" />
          <span>{docInfo.pageCount} pages</span>
        </div>
        <div className="stats-item">
          <div className="stats-dot" />
          <span>~{docInfo.wordCount.toLocaleString()} words</span>
        </div>
        <div className="stats-item">
          <div className="stats-dot" />
          <span>{docInfo.chunks.length} chunks indexed</span>
        </div>
        <div className="stats-item">
          <div className="stats-dot" style={{ background: "#86efac" }} />
          <span style={{ color: "#16a34a", fontWeight: 500 }}>AI Ready</span>
        </div>
      </div>

      {addDocError && (
        <div style={{ padding: "8px 20px", maxWidth: "720px", margin: "0 auto", width: "100%" }}>
          <ErrorBanner message={addDocError} />
        </div>
      )}

      {/* ════════════════════════════════
          CHAT PANEL
      ════════════════════════════════ */}
      <div className="chat-panel">
        <div ref={scrollAreaRef} className="messages-area scrollbar-hide">
          <div ref={messagesContainerRef} className="messages-inner">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                docInfo={docInfo}
                activeSource={activeSource}
                onToggleSource={setActiveSource}
              />
            ))}
            {chatLoading && <TypingDots />}
            {chatError && !chatLoading && (
              <div style={{ padding: "6px 0" }}>
                <ErrorBanner message={chatError} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ════════ INPUT BAR ════════ */}
        <div className="input-zone">
          <div className="input-zone-inner">
            <div className="chips-row">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  className="chip-btn"
                  disabled={chatLoading || addingDoc}
                  onClick={() => sendQuestion(p.label)}
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>

            <form id="chat-form" className="input-form" onSubmit={handleSend}>
              <input
                ref={inputRef}
                id="chat-input"
                className="input-field"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Ask anything about ${currentDocs.length > 1 ? `${currentDocs.length} documents` : "your document"}…`}
                disabled={chatLoading || addingDoc}
                autoFocus
              />
              <button
                id="send-message-btn"
                type="submit"
                disabled={!canSend}
                className={`send-btn ${canSend ? "active" : "inactive"}`}
              >
                {chatLoading
                  ? <SpinnerTeal size="sm" />
                  : <SendIcon className="w-4 h-4" style={{ color: canSend ? "white" : "#d1d5db" }} />
                }
              </button>
            </form>

            <p className="input-note">
              Answers are grounded in your PDF · Click source citations to inspect chunks
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
