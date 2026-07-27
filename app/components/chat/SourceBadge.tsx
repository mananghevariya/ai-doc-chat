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
    <div className="mt-3 pt-2.5 border-t border-[#1A1B2E]/10 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-[#4A4B63] mr-1 select-none">
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
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium transition-all ${
                isSelected
                  ? "bg-[#4C6FFF] text-white shadow-sm shadow-[#4C6FFF]/30 font-semibold"
                  : "bg-[#4C6FFF]/10 text-[#4C6FFF] border border-[#4C6FFF]/25 hover:bg-[#4C6FFF]/20"
              }`}
            >
              Source {idx}
            </button>
          );
        })}
      </div>

      {currentActiveChunk !== null && (
        <div className="mt-2 rounded-2xl border border-[#4C6FFF]/30 bg-white/90 p-4 shadow-xl shadow-[#4C6FFF]/10 text-xs text-[#1A1B2E] leading-relaxed font-sans backdrop-blur-xl">
          <div className="flex items-center justify-between text-[#4C6FFF] mb-2 font-semibold text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4C6FFF]" />
              Document Citation — Chunk {currentActiveChunk}
            </span>
            <button
              type="button"
              onClick={() => onToggleSource(null)}
              className="text-[#4A4B63] hover:text-[#1A1B2E] transition-colors"
            >
              ✕ Close
            </button>
          </div>
          <div className="max-h-44 overflow-y-auto whitespace-pre-wrap pr-1.5 bg-[#F7F8FC] rounded-xl p-3 border border-[#4C6FFF]/15 text-[#4A4B63] font-mono text-[11px] leading-normal break-words">
            {docInfo.chunks[currentActiveChunk - 1] || "Source chunk text not available."}
          </div>
        </div>
      )}
    </div>
  );
}
