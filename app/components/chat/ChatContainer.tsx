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
          isNew: true,
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
    <div className="min-h-screen flex flex-col relative bg-[#F7F8FC] text-[#1A1B2E] font-sans">
      {/* Animated Light Liquid Glass Floating Blobs (Identical to UploadZone for seamless design) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="animate-blob-1 absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-[#4C6FFF]/15 blur-3xl" />
        <div className="animate-blob-2 absolute bottom-1/4 right-1/4 w-[480px] h-[480px] rounded-full bg-[#9B7FFF]/15 blur-3xl" />
        <div className="animate-blob-3 absolute top-1/2 right-1/3 w-[380px] h-[380px] rounded-full bg-[#FF7A59]/10 blur-3xl" />
      </div>

      {/* Top Glass Header */}
      <header className="shrink-0 z-20 sticky top-0 border-b border-white/80 bg-white/70 backdrop-blur-xl px-4 py-3 sm:py-4 shadow-sm shadow-[#4C6FFF]/5">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#4C6FFF]/15 border border-[#4C6FFF]/25 flex items-center justify-center shrink-0 shadow-xs">
              <BotIcon className="w-5 h-5 text-[#4C6FFF]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[#1A1B2E] text-xs sm:text-sm font-serif font-bold leading-tight truncate max-w-[180px] sm:max-w-xs">
                {docInfo.fileName}
              </h2>
              <p className="text-[#4A4B63] text-[11px] sm:text-xs mt-0.5 font-normal">
                {docInfo.pageCount} page{docInfo.pageCount !== 1 ? "s" : ""} · ~
                {docInfo.wordCount.toLocaleString()} words · {docInfo.chunks.length} chunks
              </p>
            </div>
          </div>

          <button
            id="upload-new-btn"
            type="button"
            onClick={onReset}
            className="shrink-0 flex items-center gap-1.5 rounded-full border border-[#4C6FFF]/30 bg-[#4C6FFF]/10 px-4 py-1.5 text-xs font-semibold text-[#4C6FFF] hover:bg-[#4C6FFF]/20 transition-all duration-200 shadow-xs"
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
      <div className="shrink-0 sticky bottom-0 border-t border-white/80 bg-white/75 backdrop-blur-xl px-4 py-4 sm:py-5 z-20">
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
            className="flex-1 rounded-2xl border border-white bg-white/80 px-4 sm:px-5 py-3.5 text-xs sm:text-sm text-[#1A1B2E] placeholder-[#4A4B63]/50 outline-none transition-all shadow-xs focus:border-[#4C6FFF]/60 focus:ring-2 focus:ring-[#4C6FFF]/20 disabled:opacity-50 font-normal"
          />
          <button
            id="send-message-btn"
            type="submit"
            disabled={!inputValue.trim() || chatLoading}
            className={`
              flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl transition-all duration-300 shrink-0 shadow-md
              ${
                inputValue.trim() && !chatLoading
                  ? "bg-[#4C6FFF] hover:bg-[#3B5BEB] text-white shadow-lg shadow-[#4C6FFF]/25 hover:shadow-[#4C6FFF]/40 hover:-translate-y-0.5 active:translate-y-0"
                  : "bg-black/5 text-[#1A1B2E]/30 cursor-not-allowed border border-black/5"
              }
            `}
          >
            {chatLoading ? <Spinner size="sm" /> : <SendIcon className="w-4 h-4 text-white" />}
          </button>
        </form>
        <p className="mt-2.5 text-center text-[#4A4B63]/60 text-[11px] font-normal">
          Gemini answers are grounded in your PDF document. Click Source citations to inspect text chunks.
        </p>
      </div>
    </div>
  );
}
