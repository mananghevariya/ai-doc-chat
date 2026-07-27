"use client";

import React, { useState, useRef, useCallback } from "react";
import { DocInfo } from "@/app/types";
import { UploadIcon, PdfBadgeIcon, CheckIcon, SparklesIcon } from "../ui/Icons";
import { Spinner, ErrorBanner } from "../ui/Feedback";

interface UploadZoneProps {
  onUploadSuccess: (info: DocInfo) => void;
}

const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadZone({ onUploadSuccess }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (file.type !== "application/pdf") {
      setFileError("Only PDF files are supported.");
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setFileError(
        `File size (${formatBytes(file.size)}) exceeds the maximum allowed limit of ${MAX_SIZE_MB} MB.`
      );
      setSelectedFile(null);
      return;
    }
    setFileError(null);
    setUploadError(null);
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;
    setUploading(true);
    setUploadError(null);

    const fd = new FormData();
    fd.append("file", selectedFile);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok) {
        setUploadError(json.error ?? "Upload failed. Please try again.");
        return;
      }

      onUploadSuccess({
        chunks: json.chunks,
        pageCount: json.pageCount,
        wordCount: json.wordCount,
        fileName: selectedFile.name,
        fileSize: formatBytes(selectedFile.size),
      });
    } catch {
      setUploadError("Network connection error. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Ambient glowing luxury backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="w-[600px] h-[600px] rounded-full bg-[#8B7FD6]/10 blur-[120px] transition-all duration-700" />
        <div className="w-[350px] h-[350px] rounded-full bg-[#C9A961]/10 blur-[90px] absolute" />
      </div>

      {/* Hero Header */}
      <div className="relative z-10 mb-8 sm:mb-10 text-center max-w-xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#C9A961]/30 bg-[#C9A961]/10 px-4 py-1.5 text-xs font-medium tracking-widest text-[#C9A961] uppercase mb-6 backdrop-blur-md shadow-sm">
          <SparklesIcon className="w-3.5 h-3.5" />
          <span>Luxury Glass Architecture</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold tracking-tight text-[#F0EEF6] leading-tight">
          AI Document{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C9A961] via-[#E4D19D] to-[#8B7FD6]">
            Intelligence
          </span>
        </h1>
        <p className="mt-4 text-[#F0EEF6]/70 text-sm sm:text-base leading-relaxed px-2 font-light">
          Upload your PDF document to start an interactive, context-aware conversation powered by Gemini AI with verifiable source citations.
        </p>
      </div>

      {/* Upload Glass Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl glass-panel p-6 sm:p-8 transition-all duration-300 hover:border-[#C9A961]/30">
          <div
            id="pdf-drop-zone"
            role="button"
            tabIndex={0}
            aria-label="Drop PDF file here or click to browse"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            className={`
              relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed
              p-8 sm:p-10 cursor-pointer select-none transition-all duration-300
              ${
                isDragging
                  ? "border-[#C9A961] bg-[#C9A961]/10 scale-[1.01]"
                  : selectedFile
                    ? "border-emerald-400/50 bg-emerald-500/5"
                    : "border-white/15 hover:border-[#C9A961]/50 hover:bg-white/[0.03]"
              }
            `}
          >
            {selectedFile ? (
              <>
                <CheckIcon className="w-8 h-8 text-emerald-400" />
                <div className="text-center min-w-0">
                  <p className="text-[#F0EEF6] font-semibold text-sm leading-snug max-w-[240px] truncate mx-auto">
                    {selectedFile.name}
                  </p>
                  <p className="text-[#F0EEF6]/50 text-xs mt-1">
                    {formatBytes(selectedFile.size)} · Ready for extraction
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setFileError(null);
                  }}
                  className="text-xs text-[#C9A961] hover:underline underline-offset-2 transition-colors mt-1"
                >
                  Choose a different file
                </button>
              </>
            ) : (
              <>
                <UploadIcon className="w-10 h-10 text-[#C9A961]" />
                <div className="text-center">
                  <p className="text-[#F0EEF6] font-medium text-sm">
                    Drag and drop your PDF here, or{" "}
                    <span className="text-[#C9A961] underline underline-offset-4 decoration-[#C9A961]/40">
                      browse
                    </span>
                  </p>
                  <p className="text-[#F0EEF6]/40 text-xs mt-1.5">
                    PDF files only · Up to {MAX_SIZE_MB} MB
                  </p>
                </div>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            id="pdf-file-input"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />

          {fileError && (
            <div className="mt-4">
              <ErrorBanner message={fileError} />
            </div>
          )}
          {uploadError && (
            <div className="mt-4">
              <ErrorBanner message={uploadError} />
            </div>
          )}

          <button
            id="upload-pdf-btn"
            type="button"
            disabled={!selectedFile || uploading}
            onClick={handleUpload}
            className={`
              mt-5 w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold tracking-wide
              transition-all duration-300
              ${
                selectedFile && !uploading
                  ? "bg-gradient-to-r from-[#C9A961] to-[#b08e45] text-[#0B0B1E] font-bold shadow-lg shadow-[#C9A961]/20 hover:shadow-[#C9A961]/35 hover:-translate-y-0.5 active:translate-y-0"
                  : "bg-white/5 text-[#F0EEF6]/30 border border-white/5 cursor-not-allowed"
              }
            `}
          >
            {uploading ? (
              <>
                <Spinner size="sm" />
                <span>Processing Document…</span>
              </>
            ) : (
              <>
                <PdfBadgeIcon className="w-4 h-4 text-[#0B0B1E]" />
                <span>Analyze Document</span>
              </>
            )}
          </button>

          <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap gap-2 justify-center">
            {["PDF Parser", "Source Grounding", "Gemini AI"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-[#F0EEF6]/60 font-light"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
