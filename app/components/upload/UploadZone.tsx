"use client";

import React, { useState, useRef, useCallback } from "react";
import { DocInfo, DocumentItem } from "@/app/types";
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
    if (file.type !== "application/pdf") { setFileError("Only PDF files are supported."); setSelectedFile(null); return; }
    if (file.size > MAX_SIZE_BYTES) { setFileError(`File size (${formatBytes(file.size)}) exceeds ${MAX_SIZE_MB} MB.`); setSelectedFile(null); return; }
    setFileError(null); setUploadError(null); setSelectedFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0]; if (f) processFile(f);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;
    setUploading(true); setUploadError(null);
    const fd = new FormData(); fd.append("file", selectedFile);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error ?? "Upload failed."); return; }
      const taggedChunks = json.chunks.map((c: string) => `[Document: ${selectedFile.name}]\n${c}`);
      const docItem: DocumentItem = { id: Math.random().toString(36).slice(2, 9), fileName: selectedFile.name, fileSize: formatBytes(selectedFile.size), pageCount: json.pageCount, wordCount: json.wordCount, chunks: taggedChunks };
      onUploadSuccess({ documents: [docItem], chunks: taggedChunks, pageCount: json.pageCount, wordCount: json.wordCount, fileName: selectedFile.name, fileSize: formatBytes(selectedFile.size) });
    } catch { setUploadError("Network connection error. Please try again."); }
    finally { setUploading(false); }
  };

  return (
    <div className="upload-root">
      <div style={{ position: "relative", zIndex: 2, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          background: "#EFF6FF", border: "1px solid #BFDBFE",
          borderRadius: "999px", padding: "5px 14px",
          fontSize: "11px", fontWeight: 700, color: "#1D4ED8",
          textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "20px"
        }}>
          <SparklesIcon className="w-3.5 h-3.5" style={{ color: "#0EA5E9" }} />
          <span>Document Intelligence · Gemini AI</span>
        </div>

        {/* Hero */}
        <div style={{ textAlign: "center", maxWidth: "480px", marginBottom: "30px" }}>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, color: "#111827", lineHeight: 1.2, letterSpacing: "-0.025em", marginBottom: "12px" }}>
            Chat with Your{" "}
            <span className="gradient-text">PDF Documents</span>
          </h1>
          <p style={{ color: "#6B7280", fontSize: "15px", lineHeight: 1.65, fontWeight: 400, maxWidth: "420px", margin: "0 auto" }}>
            Upload any PDF and instantly get AI-powered answers with exact source citations.
          </p>
        </div>

        {/* Upload Card */}
        <div className="upload-card">
          {/* Drop Zone */}
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
            className={`drop-zone ${isDragging ? "dragging" : ""} ${selectedFile ? "ready" : ""}`}
          >
            {selectedFile ? (
              <>
                <div style={{
                  width: 52, height: 52, borderRadius: "14px",
                  background: "linear-gradient(135deg, #0EA5E9, #0D9488)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 6px 18px rgba(14,165,233,0.3)"
                }}>
                  <CheckIcon className="w-6 h-6" style={{ color: "white" }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontWeight: 600, fontSize: "14px", color: "#111827", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedFile.name}
                  </p>
                  <p style={{ color: "#9CA3AF", fontSize: "12px", marginTop: "4px" }}>
                    {formatBytes(selectedFile.size)} · Ready to analyze
                  </p>
                </div>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setFileError(null); }}
                  style={{ fontSize: "12px", color: "#0EA5E9", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "Inter, sans-serif" }}>
                  Choose a different file
                </button>
              </>
            ) : (
              <>
                <div style={{
                  width: 56, height: 56, borderRadius: "16px",
                  background: "#EFF6FF", border: "1.5px solid #BAE6FD",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <UploadIcon className="w-7 h-7" style={{ color: "#0EA5E9" }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#374151", fontWeight: 500, fontSize: "14px" }}>
                    Drag & drop your PDF here, or{" "}
                    <span style={{ color: "#0EA5E9", fontWeight: 700, cursor: "pointer" }}>browse</span>
                  </p>
                  <p style={{ color: "#9CA3AF", fontSize: "12px", marginTop: "6px" }}>
                    PDF files only · Up to {MAX_SIZE_MB} MB
                  </p>
                </div>
              </>
            )}
          </div>

          <input ref={fileInputRef} id="pdf-file-input" type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleFileChange} />

          {fileError && <div style={{ marginTop: "14px" }}><ErrorBanner message={fileError} /></div>}
          {uploadError && <div style={{ marginTop: "14px" }}><ErrorBanner message={uploadError} /></div>}

          <button
            id="upload-pdf-btn" type="button"
            disabled={!selectedFile || uploading}
            onClick={handleUpload}
            className={`upload-btn ${selectedFile && !uploading ? "active" : "disabled"}`}
            style={{ marginTop: "18px" }}
          >
            {uploading ? (
              <><Spinner size="sm" color="white" /><span>Analyzing Document…</span></>
            ) : (
              <><PdfBadgeIcon className="w-4 h-4" style={{ color: "white" }} /><span>Analyze Document</span></>
            )}
          </button>

          {/* Feature tags */}
          <div style={{ marginTop: "20px", paddingTop: "18px", borderTop: "1px solid #F3F4F6", display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
            {[{ icon: "📄", text: "Multi-PDF" }, { icon: "🔗", text: "Source Citations" }, { icon: "⚡", text: "Instant Answers" }].map((t) => (
              <span key={t.text} style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                background: "#F9FAFB", border: "1px solid #E5E7EB",
                borderRadius: "999px", padding: "4px 12px",
                fontSize: "12px", fontWeight: 500, color: "#374151"
              }}>
                {t.icon} {t.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
