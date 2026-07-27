"use client";

import React, { useState, useEffect } from "react";
import { ActiveSource, DocInfo, Message } from "@/app/types";
import { BotIcon, UserIcon } from "../ui/Icons";
import SourceBadge from "./SourceBadge";

interface MessageBubbleProps {
  message: Message;
  docInfo: DocInfo;
  activeSource: ActiveSource | null;
  onToggleSource: (source: ActiveSource | null) => void;
}

function parseInlineMarkdown(text: string, isUser: boolean): React.ReactNode[] {
  const regex = /(\*\*(.*?)\*\*|\*(.*?)\*|`(.*?)`)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));

    const fullMatch = match[0];
    if (fullMatch.startsWith("**") && fullMatch.endsWith("**")) {
      parts.push(
        <strong key={match.index} style={{ fontWeight: 600, color: isUser ? "rgba(255,255,255,0.95)" : "#111827" }}>
          {match[2]}
        </strong>
      );
    } else if (fullMatch.startsWith("*") && fullMatch.endsWith("*")) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (fullMatch.startsWith("`") && fullMatch.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          style={{
            background: isUser ? "rgba(255,255,255,0.2)" : "#f3f4f6",
            color: isUser ? "white" : "#6d28d9",
            borderRadius: "4px",
            padding: "1px 6px",
            fontFamily: "monospace",
            fontSize: "12px",
            border: isUser ? "none" : "1px solid #e5e7eb",
          }}
        >
          {match[4]}
        </code>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.substring(lastIndex));
  return parts.length > 0 ? parts : [text];
}

function renderMarkdown(text: string, isUser: boolean) {
  if (!text) return null;
  const lines = text.split("\n");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: "6px" }} />;

        const isBullet = /^[*-]\s+/.test(trimmed);
        const content = isBullet ? trimmed.replace(/^[*-]\s+/, "") : line;
        const parsed = parseInlineMarkdown(content, isUser);

        if (isBullet) {
          return (
            <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: isUser ? "rgba(255,255,255,0.7)" : "#667eea",
                flexShrink: 0, marginTop: "8px"
              }} />
              <div style={{ flex: 1, lineHeight: "1.7" }}>{parsed}</div>
            </div>
          );
        }
        return <div key={i} style={{ lineHeight: "1.7" }}>{parsed}</div>;
      })}
    </div>
  );
}

export default function MessageBubble({
  message,
  docInfo,
  activeSource,
  onToggleSource,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [displayedText, setDisplayedText] = useState(
    isUser || !message.isNew ? message.content : ""
  );

  useEffect(() => {
    if (isUser || !message.isNew || !message.content) {
      setDisplayedText(message.content);
      return;
    }
    const words = message.content.split(" ");
    if (words.length <= 1) { setDisplayedText(message.content); return; }

    const intervalMs = Math.max(10, Math.min(40, 1000 / words.length));
    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      if (idx >= words.length) { setDisplayedText(message.content); clearInterval(timer); }
      else setDisplayedText(words.slice(0, idx).join(" "));
    }, intervalMs);

    return () => clearInterval(timer);
  }, [message.content, message.isNew, isUser]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`msg-row ${isUser ? "user" : ""}`}>
      {/* Avatar */}
      <div className={`avatar ${isUser ? "avatar-user" : "avatar-ai"}`}>
        {isUser
          ? <UserIcon className="w-4 h-4" style={{ color: "white" }} />
          : <BotIcon className="w-4 h-4" style={{ color: "white" }} />
        }
      </div>

      {/* Bubble */}
      <div className={isUser ? "bubble-user" : "bubble-ai"}>
        {renderMarkdown(displayedText, isUser)}

        {/* AI footer */}
        {!isUser && (
          <div className="msg-footer">
            <div>
              {message.sourceChunkIndexes && (
                <SourceBadge
                  msgId={message.id}
                  sourceChunkIndexes={message.sourceChunkIndexes}
                  docInfo={docInfo}
                  activeSource={activeSource}
                  onToggleSource={onToggleSource}
                />
              )}
            </div>
            <button className="copy-btn" onClick={handleCopy} title="Copy">
              {copied ? (
                <>
                  <svg width="13" height="13" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span style={{ color: "#10b981", fontWeight: 600 }}>Copied!</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
