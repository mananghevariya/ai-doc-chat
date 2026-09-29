import React from "react";
import { BotIcon } from "./Icons";

export function Spinner({ size = "md", color = "currentColor" }: { size?: "sm" | "md"; color?: string }) {
  const sz = size === "sm" ? 16 : 20;
  return (
    <svg
      width={sz} height={sz}
      style={{ color, animation: "spin 0.8s linear infinite" }}
      fill="none" viewBox="0 0 24 24" aria-label="Loading"
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// Alias for teal-colored spinner
export function SpinnerTeal({ size = "md" }: { size?: "sm" | "md" }) {
  return <Spinner size={size} color="currentColor" />;
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-error-container/30 border border-error-container rounded-xl p-3 text-sm text-on-error-container" role="alert">
      <span className="material-symbols-outlined text-[18px] text-error shrink-0 mt-0.5">warning</span>
      <span>{message}</span>
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="flex gap-2 items-center">
      <style>{`
        @keyframes tdot {
          0%, 60%, 100% { transform: translateY(0) scale(1); opacity: 0.5; }
          30% { transform: translateY(-4px) scale(1.2); opacity: 1; }
        }
      `}</style>
      <div className="w-2 h-2 rounded-full bg-primary" style={{ animation: "tdot 1.3s ease-in-out infinite" }} />
      <div className="w-2 h-2 rounded-full bg-secondary" style={{ animation: "tdot 1.3s ease-in-out infinite", animationDelay: "0.18s" }} />
      <div className="w-2 h-2 rounded-full bg-tertiary" style={{ animation: "tdot 1.3s ease-in-out infinite", animationDelay: "0.36s" }} />
    </div>
  );
}
