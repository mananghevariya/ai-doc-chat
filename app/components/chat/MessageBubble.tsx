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
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
            isUser
              ? "bg-[#4C6FFF] text-white font-semibold"
              : "bg-[#4C6FFF]/15 border border-[#4C6FFF]/25 text-[#4C6FFF]"
          }`}
        >
          {isUser ? <UserIcon className="w-4 h-4 text-white" /> : <BotIcon className="w-4 h-4 text-[#4C6FFF]" />}
        </div>

        {/* Message Content Bubble */}
        <div
          className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 sm:px-5 py-3.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words transition-all ${
            isUser
              ? "bg-[#4C6FFF] text-white font-medium rounded-tr-xs shadow-md shadow-[#4C6FFF]/20"
              : "bg-white/85 border border-white text-[#1A1B2E] rounded-tl-xs shadow-xl shadow-[#4C6FFF]/5 backdrop-blur-xl"
          }`}
        >
          <div>{displayedText}</div>

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
