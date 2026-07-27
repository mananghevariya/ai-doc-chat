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

  const currentActiveChunk =
    activeSource?.msgId === msgId ? activeSource.chunkIndex : null;

  return (
    <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-[#F0EEF6]/50 mr-1 select-none">
          Sources:
        </span>
        {sourceChunkIndexes.map((idx) => {
          const isSelected = currentActiveChunk === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (isSelected) {
                  onToggleSource(null);
                } else {
                  onToggleSource({ msgId, chunkIndex: idx });
                }
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                isSelected
                  ? "bg-[#C9A961] text-[#0B0B1E] shadow-sm font-semibold"
                  : "bg-[#C9A961]/10 text-[#C9A961] border border-[#C9A961]/20 hover:bg-[#C9A961]/20"
              }`}
            >
              Source {idx}
            </button>
          );
        })}
      </div>

      {currentActiveChunk !== null && (
        <div className="mt-2 rounded-xl border border-[#C9A961]/30 bg-[#0B0B1E]/95 p-3.5 shadow-xl text-xs text-[#F0EEF6]/90 leading-relaxed font-sans backdrop-blur-md">
          <div className="flex items-center justify-between text-[#C9A961] mb-2 font-semibold text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A961]" />
              Document Citation — Chunk {currentActiveChunk}
            </span>
            <button
              type="button"
              onClick={() => onToggleSource(null)}
              className="text-[#F0EEF6]/40 hover:text-white transition-colors"
            >
              ✕ Close
            </button>
          </div>
          <div className="max-h-44 overflow-y-auto whitespace-pre-wrap pr-1.5 bg-black/40 rounded-lg p-3 border border-white/5 text-[#F0EEF6]/80 font-mono text-[11px] leading-normal break-words">
            {docInfo.chunks[currentActiveChunk - 1] || "Source chunk text not available."}
          </div>
        </div>
      )}
    </div>
  );
}
