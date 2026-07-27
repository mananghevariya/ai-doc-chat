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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden bg-[#F7F8FC]">
      {/* Animated Light Liquid Glass Floating Blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="animate-blob-1 absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-[#4C6FFF]/20 blur-3xl" />
        <div className="animate-blob-2 absolute bottom-1/4 right-1/4 w-[480px] h-[480px] rounded-full bg-[#9B7FFF]/20 blur-3xl" />
        <div className="animate-blob-3 absolute top-1/2 right-1/3 w-[380px] h-[380px] rounded-full bg-[#FF7A59]/15 blur-3xl" />
      </div>

      {/* Hero Header */}
      <div className="relative z-10 mb-8 sm:mb-10 text-center max-w-xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#FF7A59]/30 bg-[#FF7A59]/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-[#FF7A59] uppercase mb-6 backdrop-blur-md shadow-sm">
          <SparklesIcon className="w-3.5 h-3.5 text-[#FF7A59]" />
          <span>Light Liquid Glass</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-serif font-bold tracking-tight text-[#1A1B2E] leading-tight">
          AI Document{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4C6FFF] via-[#9B7FFF] to-[#FF7A59]">
            Intelligence
          </span>
        </h1>
        <p className="mt-4 text-[#4A4B63] text-sm sm:text-base leading-relaxed px-2 font-normal">
          Upload your PDF document to start an interactive, context-aware conversation powered by Gemini AI with verifiable source citations.
        </p>
      </div>

      {/* Upload Glass Panel */}
      <div className="relative z-10 w-full max-w-md">
        <div className="light-glass-panel p-6 sm:p-8 transition-all duration-300">
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
              relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed
              p-8 sm:p-10 cursor-pointer select-none transition-all duration-300
              ${
                isDragging
                  ? "border-[#4C6FFF] bg-[#4C6FFF]/10 scale-[1.01]"
                  : selectedFile
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : "border-[#4C6FFF]/20 bg-white/40 hover:border-[#4C6FFF]/50 hover:bg-white/60"
              }
            `}
          >
            {selectedFile ? (
              <>
                <CheckIcon className="w-8 h-8 text-emerald-500" />
                <div className="text-center min-w-0">
                  <p className="text-[#1A1B2E] font-semibold text-sm leading-snug max-w-[240px] truncate mx-auto">
                    {selectedFile.name}
                  </p>
                  <p className="text-[#4A4B63] text-xs mt-1">
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
                  className="text-xs text-[#4C6FFF] hover:underline underline-offset-2 transition-colors font-medium mt-1"
                >
                  Choose a different file
                </button>
              </>
            ) : (
              <>
                <UploadIcon className="w-10 h-10 text-[#4C6FFF]" />
                <div className="text-center">
                  <p className="text-[#1A1B2E] font-medium text-sm">
                    Drag and drop your PDF here, or{" "}
                    <span className="text-[#4C6FFF] font-semibold underline underline-offset-4 decoration-[#4C6FFF]/40">
                      browse
                    </span>
                  </p>
                  <p className="text-[#4A4B63]/70 text-xs mt-1.5 font-normal">
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
              mt-5 w-full flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold tracking-wide
              transition-all duration-300 shadow-md
              ${
                selectedFile && !uploading
                  ? "bg-[#4C6FFF] hover:bg-[#3B5BEB] text-white shadow-lg shadow-[#4C6FFF]/25 hover:shadow-[#4C6FFF]/40 hover:-translate-y-0.5 active:translate-y-0"
                  : "bg-black/5 text-[#1A1B2E]/30 border border-black/5 cursor-not-allowed"
              }
            `}
          >
            {uploading ? (
              <>
                <Spinner size="sm" />
                <span className="text-white">Processing Document…</span>
              </>
            ) : (
              <>
                <PdfBadgeIcon className="w-4 h-4 text-white" />
                <span>Analyze Document</span>
              </>
            )}
          </button>

          <div className="mt-6 pt-4 border-t border-[#1A1B2E]/10 flex flex-wrap gap-2 justify-center">
            {["PDF Parser", "Source Grounding", "Gemini AI"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#4C6FFF]/20 bg-white/60 px-3 py-1 text-[11px] text-[#4A4B63] font-medium shadow-xs"
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
