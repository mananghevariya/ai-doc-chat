import React from "react";
import { BotIcon } from "./Icons";

export function Spinner({ size = "md" }: { size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <svg
      className={`${cls} animate-spin text-[#4C6FFF]`}
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
      className="flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-rose-700 text-xs sm:text-sm backdrop-blur-md font-medium"
    >
      <span className="mt-0.5 shrink-0 text-rose-500">⚠</span>
      <span>{message}</span>
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-[#4C6FFF]/15 border border-[#4C6FFF]/25 flex items-center justify-center shrink-0 shadow-sm">
        <BotIcon className="w-4 h-4 text-[#4C6FFF]" />
      </div>
      <div className="rounded-[22px] rounded-bl-xs border border-white/80 bg-white/75 backdrop-blur-xl px-4 py-3 shadow-lg shadow-[#4C6FFF]/5">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#4C6FFF] animate-bounce"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
