"use client";

import React, { useState } from 'react';
import { CheckCheck, User, Sparkles, ThumbsUp, ThumbsDown, Copy, Check, BookmarkPlus } from 'lucide-react';
import { ActiveSource, DocInfo, Message } from "@/app/types";
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
    <div className="flex flex-col gap-1">
      {text.split("\n").map((line, i) => (
        <p key={i} className="font-body-md text-body-md leading-relaxed">{line}</p>
      ))}
    </div>
  );
}

const markdownComponents = {
  h1: ({ node, ...props }: any) => <h1 className="text-headline-lg font-headline-lg mt-4 mb-2 text-on-surface" {...props} />,
  h2: ({ node, ...props }: any) => <h2 className="text-headline-sm font-headline-sm mt-4 mb-2 text-on-surface" {...props} />,
  h3: ({ node, ...props }: any) => <h3 className="text-label-lg font-label-lg mt-3 mb-2 text-on-surface" {...props} />,
  p: ({ node, ...props }: any) => <p className="mb-2 leading-relaxed" {...props} />,
  ul: ({ node, ...props }: any) => <ul className="my-2 pl-6 list-disc" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="my-2 pl-6 list-decimal" {...props} />,
  li: ({ node, ...props }: any) => <li className="mb-1 leading-relaxed" {...props} />,
  strong: ({ node, ...props }: any) => <strong className="font-bold text-on-surface" {...props} />,
  em: ({ node, ...props }: any) => <em className="italic" {...props} />,
  code: ({ node, inline, ...props }: any) => (
    <code className="bg-surface-container-high text-primary rounded px-1.5 py-0.5 font-mono text-sm border border-outline-variant" {...props} />
  ),
  pre: ({ node, ...props }: any) => (
    <pre className="overflow-x-auto p-3 bg-inverse-surface text-inverse-on-surface rounded-lg my-3 text-sm" {...props} />
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

  if (isUser) {
    return (
      <div className="flex justify-end items-start gap-3 w-full mt-4">
        <div className="flex flex-col items-end max-w-xl gap-1">
          <div className="bg-primary text-on-primary py-2.5 px-4 rounded-3xl rounded-br-sm shadow-md">
            {renderUserMessage(message.content)}
          </div>
          <div className="flex items-center gap-1 mt-1 pr-1 opacity-60">
            <span className="text-[10px] uppercase font-medium text-gray-500 tracking-wide">Delivered</span>
            <CheckCheck size={14} className="text-primary" />
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm text-on-primary shrink-0 mb-5">
          <User size={16} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4 w-full">
      <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center shadow-sm text-on-primary shrink-0 mt-1">
        <Sparkles size={16} />
      </div>
      <div className="flex-1 py-1 flex flex-col gap-2 transition-all">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="font-semibold text-[14px] text-[#1f1f1f] tracking-wide">DocuMind AI</span>
          </div>
        </div>
        
        <div className="font-body-md text-body-md text-on-surface leading-relaxed">
          <ReactMarkdown components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        </div>

        {message.content && (
          <div className="flex items-center justify-between pt-space-sm  mt-2">
            <div className="flex items-center gap-space-xs">
              <button aria-label="Helpful" className="p-1.5 flex items-center justify-center text-gray-400 hover:text-green-600 transition-colors" type="button">
                <ThumbsUp size={14} />
              </button>
              <button aria-label="Not helpful" className="p-1.5 flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors" type="button">
                <ThumbsDown size={14} />
              </button>
              <button onClick={handleCopy} aria-label="Copy summary" className="p-1.5 flex items-center justify-center text-gray-400 hover:text-gray-800 transition-colors" type="button">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              {copied && <span className="text-primary font-label-sm text-label-sm ml-2">Copied!</span>}
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 text-[12px] font-medium transition-colors" type="button">
              <BookmarkPlus size={14} />
              <span>Save to Canvas</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
