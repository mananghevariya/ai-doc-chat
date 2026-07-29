"use client";

import React from "react";
import { ActiveSource, DocInfo } from "@/app/types";

interface SourceBadgeProps {
  msgId: string;
  sourceChunkIndexes: number[];
  docInfo: DocInfo;
  activeSource: ActiveSource | null;
  onToggleSource: (source: ActiveSource | null) => void;
}

export default function SourceBadge({
  msgId,
  sourceChunkIndexes,
  docInfo,
  activeSource,
  onToggleSource,
}: SourceBadgeProps) {
  if (!sourceChunkIndexes || sourceChunkIndexes.length === 0) return null;
  const currentActive = activeSource?.msgId === msgId ? activeSource.chunkIndex : null;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Sources:
        </span>
        {sourceChunkIndexes.map((idx) => {
          const chunkText = docInfo.chunks[idx - 1] || "";
          const docMatch = chunkText.match(/^\[Document: (.*?)\]\n/);
          let docName = docMatch ? docMatch[1] : "";
          if (docName.length > 15) docName = docName.substring(0, 12) + "...";
          
          return (
            <button
              key={idx}
              className={`src-btn ${currentActive === idx ? "active" : ""}`}
              onClick={() => onToggleSource(currentActive === idx ? null : { msgId, chunkIndex: idx })}
            >
              {docName ? `${docName} #${idx}` : `#${idx}`}
            </button>
          );
        })}
      </div>

      {currentActive !== null && (
        <div className="src-preview">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: "linear-gradient(135deg, #667eea, #764ba2)"
              }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#6d28d9", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Source {currentActive}
              </span>
            </div>
            <button
              onClick={() => onToggleSource(null)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "12px", color: "#6b7280", fontFamily: "Inter, sans-serif",
                padding: "2px 6px", borderRadius: "4px"
              }}
            >
              ✕ Close
            </button>
          </div>
          <div style={{
            maxHeight: "160px", overflowY: "auto", whiteSpace: "pre-wrap",
            fontSize: "11px", lineHeight: "1.65", color: "#374151",
            fontFamily: "monospace", wordBreak: "break-word",
            background: "white", borderRadius: "8px", padding: "12px",
            border: "1px solid #e5e7eb"
          }}>
            {(docInfo.chunks[currentActive - 1] || "Source chunk not available.").replace(/^\[Document: .*?\]\n/, "")}
          </div>
        </div>
      )}
    </div>
  );
}
