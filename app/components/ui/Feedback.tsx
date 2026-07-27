import React from "react";
import { BotIcon } from "./Icons";

export function Spinner({ size = "md" }: { size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <svg
      className={`${cls} animate-spin text-[#C9A961]`}
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-200 text-xs sm:text-sm backdrop-blur-md"
    >
      <span className="mt-0.5 shrink-0 text-rose-400">⚠</span>
      <span>{message}</span>
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-[#8B7FD6]/20 border border-[#8B7FD6]/30 flex items-center justify-center shrink-0">
        <BotIcon className="w-4 h-4 text-[#8B7FD6]" />
      </div>
      <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-[#14142B]/70 backdrop-blur-md px-4 py-3 shadow-lg">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#C9A961] animate-bounce"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
