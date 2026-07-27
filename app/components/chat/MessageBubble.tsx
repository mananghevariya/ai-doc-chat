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

export default function MessageBubble({
  message,
  docInfo,
  activeSource,
  onToggleSource,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Typewriter effect logic for fresh assistant messages
  const [displayedText, setDisplayedText] = useState(
    isUser || !message.isNew ? message.content : ""
  );

  useEffect(() => {
    if (isUser || !message.isNew || !message.content) {
      setDisplayedText(message.content);
      return;
    }

    const words = message.content.split(" ");
    if (words.length <= 1) {
      setDisplayedText(message.content);
      return;
    }

    // Aim to finish entire animation in ~1.2 seconds max
    const intervalMs = Math.max(12, Math.min(45, 1200 / words.length));
    let currentIdx = 0;

    const timer = setInterval(() => {
      currentIdx++;
      if (currentIdx >= words.length) {
        setDisplayedText(message.content);
        clearInterval(timer);
      } else {
        setDisplayedText(words.slice(0, currentIdx).join(" "));
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [message.content, message.isNew, isUser]);

  return (
    <div className="mb-5 sm:mb-6">
      <div
        className={`flex items-start gap-3 ${
          isUser ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Avatar */}
        <div
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 shadow-md ${
            isUser
              ? "bg-[#C9A961] text-[#0B0B1E] font-semibold"
              : "bg-[#8B7FD6]/20 border border-[#8B7FD6]/30 text-[#8B7FD6]"
          }`}
        >
          {isUser ? <UserIcon className="w-4 h-4" /> : <BotIcon className="w-4 h-4" />}
        </div>

        {/* Message Content Bubble */}
        <div
          className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 sm:px-5 py-3.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words transition-all ${
            isUser
              ? "bg-gradient-to-r from-[#C9A961] to-[#b08e45] text-[#0B0B1E] font-medium rounded-tr-xs shadow-md shadow-[#C9A961]/10"
              : "glass-panel text-[#F0EEF6] rounded-tl-xs shadow-xl"
          }`}
        >
          <div>{displayedText}</div>

          {/* Sources component for assistant messages */}
          {!isUser && message.sourceChunkIndexes && (
            <SourceBadge
              msgId={message.id}
              sourceChunkIndexes={message.sourceChunkIndexes}
              docInfo={docInfo}
              activeSource={activeSource}
              onToggleSource={onToggleSource}
            />
          )}
        </div>
      </div>
    </div>
  );
}
