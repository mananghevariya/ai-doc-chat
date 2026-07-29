"use client";

import React, { useState } from "react";
import { ActiveSource, DocInfo, Message } from "@/app/types";
import { BotIcon, UserIcon } from "../ui/Icons";
import SourceBadge from "./SourceBadge";
import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
  message: Message;
  docInfo: DocInfo;
  activeSource: ActiveSource | null;
  onToggleSource: (source: ActiveSource | null) => void;
}

function renderUserMessage(text: string) {
  if (!text) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {text.split("\n").map((line, i) => (
        <div key={i} style={{ lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
          {line}
        </div>
      ))}
    </div>
  );
}

const markdownComponents = {
  h1: ({ node, ...props }: any) => <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "1.25rem", marginBottom: "0.5rem", color: "#111827" }} {...props} />,
  h2: ({ node, ...props }: any) => <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "1rem", marginBottom: "0.5rem", color: "#111827" }} {...props} />,
  h3: ({ node, ...props }: any) => <h3 style={{ fontSize: "1rem", fontWeight: 600, marginTop: "1rem", marginBottom: "0.5rem", color: "#111827" }} {...props} />,
  p: ({ node, ...props }: any) => <p style={{ marginBottom: "0.5rem", lineHeight: "1.7" }} {...props} />,
  ul: ({ node, ...props }: any) => <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem", listStyleType: "disc" }} {...props} />,
  ol: ({ node, ...props }: any) => <ol style={{ margin: "0.5rem 0", paddingLeft: "1.5rem", listStyleType: "decimal" }} {...props} />,
  li: ({ node, ...props }: any) => <li style={{ marginBottom: "0.25rem", lineHeight: "1.7" }} {...props} />,
  strong: ({ node, ...props }: any) => <strong style={{ fontWeight: 700, color: "#111827" }} {...props} />,
  em: ({ node, ...props }: any) => <em style={{ fontStyle: "italic" }} {...props} />,
  code: ({ node, inline, ...props }: any) => (
    <code
      style={{
        background: "#f3f4f6",
        color: "#6d28d9",
        borderRadius: "4px",
        padding: "2px 6px",
        fontFamily: "monospace",
        fontSize: "12px",
        border: "1px solid #e5e7eb",
      }}
      {...props}
    />
  ),
  pre: ({ node, ...props }: any) => (
    <pre
      style={{
        overflowX: "auto",
        padding: "12px",
        background: "#1f2937",
        color: "#f3f4f6",
        borderRadius: "8px",
        margin: "12px 0",
        fontSize: "12px",
      }}
      {...props}
    />
  ),
};

export default function MessageBubble({
  message,
  docInfo,
  activeSource,
  onToggleSource,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

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
        {isUser ? (
          renderUserMessage(message.content)
        ) : (
          <ReactMarkdown components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        )}

        {/* AI footer */}
        {!isUser && message.content && (
          <div className="msg-footer">
            <div>
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
