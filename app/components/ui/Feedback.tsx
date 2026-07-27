import React from "react";
import { BotIcon } from "./Icons";

export function Spinner({ size = "md", color = "white" }: { size?: "sm" | "md"; color?: string }) {
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
  return <Spinner size={size} color="#667eea" />;
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="error-banner" role="alert">
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠</span>
      <span>{message}</span>
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="typing-row">
      <div className="avatar avatar-ai">
        <BotIcon className="w-4 h-4" style={{ color: "white" }} />
      </div>
      <div className="typing-bubble">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}
