// Server Component — no 'use client' needed, purely static UI
export default function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 text-center">
      {/* Glowing orb decoration */}
      <div
        aria-hidden="true"
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-indigo-600/20 blur-3xl pointer-events-none"
      />

      {/* Badge */}
      <span className="relative z-10 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300 backdrop-blur-sm mb-8 tracking-wide">
        <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
        Coming Soon
      </span>

      {/* Heading */}
      <h1 className="relative z-10 text-4xl sm:text-6xl font-bold text-white tracking-tight leading-tight mb-4">
        AI Document{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
          Chat
        </span>
      </h1>

      {/* Subtitle */}
      <p className="relative z-10 max-w-md text-slate-400 text-lg leading-relaxed mb-10">
        Upload your PDFs and have intelligent conversations with your documents
        — powered by Gemini AI.
      </p>

      {/* Feature pills */}
      <div className="relative z-10 flex flex-wrap justify-center gap-3">
        {["PDF Upload", "Gemini AI", "Instant Answers", "Chat History"].map(
          (feature) => (
            <span
              key={feature}
              className="rounded-full border border-slate-700 bg-slate-800/60 px-4 py-1.5 text-sm text-slate-300 backdrop-blur-sm"
            >
              {feature}
            </span>
          )
        )}
      </div>
    </div>
  );
}
