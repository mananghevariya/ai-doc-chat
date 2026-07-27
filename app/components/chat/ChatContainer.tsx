"use client";

import React, { useState, useRef, useEffect, FormEvent } from "react";
import { ActiveSource, DocInfo, Message, ChatResponse } from "@/app/types";
import { BotIcon, SendIcon } from "../ui/Icons";
import { Spinner, ErrorBanner, TypingDots } from "../ui/Feedback";
import MessageBubble from "./MessageBubble";

interface ChatContainerProps {
  docInfo: DocInfo;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onReset: () => void;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export default function ChatContainer({
  docInfo,
  messages,
  setMessages,
  onReset,
}: ChatContainerProps) {
  const [inputValue, setInputValue] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<ActiveSource | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const question = inputValue.trim();
    if (!question || chatLoading) return;

    setInputValue("");
    setChatError(null);

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, documentChunks: docInfo.chunks }),
      });

      const json: ChatResponse = await res.json();

      if (!res.ok) {
        setChatError(json.error ?? "Failed to generate AI response.");
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: json.answer,
          sourceChunkIndexes: json.sourceChunkIndexes,
          isNew: true, // triggers typewriter animation for fresh answer
        },
      ]);
    } catch {
      setChatError("Network connection error. Please try again.");
    } finally {
      setChatLoading(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-gradient-to-br from-[#0B0B1E] via-[#0F0F2D] to-[#14142B] text-[#F0EEF6] font-sans">
      {/* Ambient background glow to match UploadZone hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden"
      >
        <div className="w-[700px] h-[700px] rounded-full bg-[#8B7FD6]/5 blur-[140px]" />
        <div className="w-[400px] h-[400px] rounded-full bg-[#C9A961]/5 blur-[100px] absolute" />
      </div>

      {/* Top Glass Header */}
      <header className="shrink-0 z-20 sticky top-0 border-b border-white/10 bg-[#0B0B1E]/80 backdrop-blur-xl px-4 py-3 sm:py-4 shadow-lg">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#C9A961]/15 border border-[#C9A961]/30 flex items-center justify-center shrink-0 shadow-md">
              <BotIcon className="w-5 h-5 text-[#C9A961]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-white text-xs sm:text-sm font-serif font-bold leading-tight truncate max-w-[180px] sm:max-w-xs">
                {docInfo.fileName}
              </h2>
              <p className="text-[#F0EEF6]/50 text-[11px] sm:text-xs mt-0.5 font-light">
                {docInfo.pageCount} page{docInfo.pageCount !== 1 ? "s" : ""} · ~
                {docInfo.wordCount.toLocaleString()} words · {docInfo.chunks.length} chunks
              </p>
            </div>
          </div>

          <button
            id="upload-new-btn"
            type="button"
            onClick={onReset}
            className="shrink-0 flex items-center gap-1.5 rounded-xl border border-[#C9A961]/40 bg-[#C9A961]/10 px-3.5 py-1.5 text-xs font-semibold text-[#C9A961] hover:bg-[#C9A961]/20 hover:border-[#C9A961]/60 shadow-sm transition-all duration-200"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>New Chat</span>
          </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <main className="flex-1 overflow-y-auto py-6 px-4 sm:px-6 relative z-10">
        <div className="mx-auto max-w-4xl">
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
            <div className="mb-6">
              <ErrorBanner message={chatError} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Sticky Glass Footer Input */}
      <div className="shrink-0 sticky bottom-0 border-t border-white/10 bg-[#0B0B1E]/85 backdrop-blur-xl px-4 py-4 sm:py-5 z-20">
        <form
          id="chat-form"
          onSubmit={handleSend}
          className="mx-auto max-w-4xl flex gap-2 sm:gap-3 items-center"
        >
          <input
            ref={inputRef}
            id="chat-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question about your PDF document…"
            disabled={chatLoading}
            autoFocus
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-4 sm:px-5 py-3 text-xs sm:text-sm text-[#F0EEF6] placeholder-[#F0EEF6]/40 outline-none transition-all focus:border-[#C9A961]/50 focus:ring-2 focus:ring-[#C9A961]/20 disabled:opacity-50"
          />
          <button
            id="send-message-btn"
            type="submit"
            disabled={!inputValue.trim() || chatLoading}
            className={`
              flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl transition-all duration-300 shrink-0
              ${
                inputValue.trim() && !chatLoading
                  ? "bg-gradient-to-r from-[#C9A961] to-[#b08e45] text-[#0B0B1E] font-bold shadow-md shadow-[#C9A961]/20 hover:shadow-[#C9A961]/35 hover:-translate-y-0.5 active:translate-y-0"
                  : "bg-white/5 text-[#F0EEF6]/30 cursor-not-allowed"
              }
            `}
          >
            {chatLoading ? <Spinner size="sm" /> : <SendIcon className="w-4 h-4" />}
          </button>
        </form>
        <p className="mt-2.5 text-center text-[#F0EEF6]/40 text-[11px] font-light">
          Gemini answers are grounded in your PDF document. Click Source citations to inspect text chunks.
        </p>
      </div>
    </div>
  );
}
