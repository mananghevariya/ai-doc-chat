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
const MAX_DOCS = 3;
const MAX_CHUNKS = 60;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export default function UploadZone({ onUploadSuccess }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const [uploadedDocs, setUploadedDocs] = useState<DocumentItem[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (file.type !== "application/pdf") { 
      setFileError("Only PDF files are supported."); 
      setSelectedFile(null); 
      return; 
    }
    if (file.size > MAX_SIZE_BYTES) { 
      setFileError(`File size (${formatBytes(file.size)}) exceeds ${MAX_SIZE_MB} MB.`); 
      setSelectedFile(null); 
      return; 
    }
    setFileError(null); 
    setUploadError(null); 
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
    setIsDragging(false);
    if (uploadedDocs.length >= MAX_DOCS) return;
    const f = e.dataTransfer.files[0]; 
    if (f) processFile(f);
  }, [processFile, uploadedDocs.length]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => { 
    e.preventDefault(); 
    if (uploadedDocs.length < MAX_DOCS) setIsDragging(true); 
  }, [uploadedDocs.length]);
  
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
    const f = e.target.files?.[0]; 
    if (f) processFile(f); 
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
        setUploadError(json.error ?? "Upload failed."); 
        setUploading(false);
        return; 
      }
      
      const currentTotalChunks = uploadedDocs.reduce((sum, d) => sum + d.chunks.length, 0);
      if (currentTotalChunks + json.chunks.length > MAX_CHUNKS) {
        setUploadError(`Adding this document would exceed the total chunk limit of ${MAX_CHUNKS} for AI processing. Please upload smaller documents.`);
        setUploading(false);
        return;
      }
      
      const taggedChunks = json.chunks.map((c: string) => `[Document: ${selectedFile.name}]\n${c}`);
      const docItem: DocumentItem = { 
        id: uid(), 
        fileName: selectedFile.name, 
        fileSize: formatBytes(selectedFile.size), 
        pageCount: json.pageCount, 
        wordCount: json.wordCount, 
        chunks: taggedChunks 
      };
      
      setUploadedDocs(prev => [...prev, docItem]);
      setSelectedFile(null); // Reset for next file
    } catch { 
      setUploadError("Network connection error. Please try again."); 
    } finally { 
      setUploading(false); 
    }
  };

  const handleStartChatting = () => {
    if (uploadedDocs.length === 0) return;
    
    const allChunks = uploadedDocs.flatMap(d => d.chunks);
    const totalPages = uploadedDocs.reduce((sum, d) => sum + d.pageCount, 0);
    const totalWords = uploadedDocs.reduce((sum, d) => sum + d.wordCount, 0);
    const name = uploadedDocs.length === 1 ? uploadedDocs[0].fileName : `${uploadedDocs.length} Documents`;
    const size = uploadedDocs[0].fileSize; // Representative size or could sum
    
    onUploadSuccess({ 
      documents: uploadedDocs, 
      chunks: allChunks, 
      pageCount: totalPages, 
      wordCount: totalWords, 
      fileName: name, 
      fileSize: size 
    });
  };

  const handleRemoveDoc = (id: string) => {
    setUploadedDocs(prev => prev.filter(d => d.id !== id));
  };

  const limitReached = uploadedDocs.length >= MAX_DOCS;
  const currentTotalChunks = uploadedDocs.reduce((sum, d) => sum + d.chunks.length, 0);
  const chunksLimitReached = currentTotalChunks >= MAX_CHUNKS;

  return (
    <div className="upload-root" style={{ minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ position: "relative", zIndex: 2, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "600px", margin: "0 auto" }}>

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
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, color: "#111827", lineHeight: 1.2, letterSpacing: "-0.025em", marginBottom: "12px" }}>
            Chat with Your{" "}
            <span className="gradient-text">PDF Documents</span>
          </h1>
          <p style={{ color: "#6B7280", fontSize: "15px", lineHeight: 1.65, fontWeight: 400, maxWidth: "420px", margin: "0 auto" }}>
            Upload up to {MAX_DOCS} PDFs to analyze them simultaneously and get AI-powered answers with exact source citations.
          </p>
        </div>

        {/* Upload Card */}
        <div className="upload-card" style={{ width: "100%", background: "white", borderRadius: "24px", padding: "32px", boxShadow: "0 10px 40px -10px rgba(0,0,0,0.08)", border: "1px solid #F3F4F6" }}>
          
          {uploadedDocs.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "12px" }}>
                Uploaded Documents ({uploadedDocs.length}/{MAX_DOCS})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {uploadedDocs.map(doc => (
                  <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", overflow: "hidden" }}>
                      <PdfBadgeIcon className="w-5 h-5 flex-shrink-0" style={{ color: "#EF4444" }} />
                      <div style={{ overflow: "hidden" }}>
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.fileName}</p>
                        <p style={{ fontSize: "12px", color: "#6B7280" }}>{doc.pageCount} pages · {doc.fileSize} · {doc.chunks.length} chunks</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemoveDoc(doc.id)}
                      style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: "4px" }}
                      title="Remove document"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drop Zone */}
          {(!limitReached && !chunksLimitReached) ? (
            <div
              id="pdf-drop-zone"
              role="button"
              tabIndex={0}
              aria-label="Drop PDF file here or click to browse"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !selectedFile && fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && !selectedFile && fileInputRef.current?.click()}
              className={`drop-zone ${isDragging ? "dragging" : ""} ${selectedFile ? "ready" : ""}`}
              style={{
                border: "2px dashed #E5E7EB", borderRadius: "16px", padding: "32px 20px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
                cursor: selectedFile ? "default" : "pointer", transition: "all 0.2s",
                background: isDragging ? "#F0F9FF" : selectedFile ? "#F9FAFB" : "transparent",
                borderColor: isDragging ? "#38BDF8" : selectedFile ? "#D1D5DB" : "#E5E7EB"
              }}
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
                  <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setFileError(null); }}
                      style={{ fontSize: "13px", color: "#6B7280", fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>
                      Cancel
                    </button>
                    <button type="button"
                      disabled={uploading}
                      onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                      style={{ fontSize: "13px", color: "white", fontWeight: 600, background: "#0EA5E9", border: "none", cursor: "pointer", padding: "6px 16px", borderRadius: "99px", display: "flex", alignItems: "center", gap: "6px" }}>
                      {uploading ? <Spinner size="sm" color="white" /> : null}
                      {uploading ? "Analyzing..." : "Confirm & Add"}
                    </button>
                  </div>
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
                      {uploadedDocs.length > 0 ? "Add another document" : "PDF files only"} · Up to {MAX_SIZE_MB} MB
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ padding: "20px", textAlign: "center", background: "#FEF2F2", border: "1px dashed #FCA5A5", borderRadius: "16px" }}>
              <p style={{ color: "#DC2626", fontSize: "14px", fontWeight: 500 }}>
                {limitReached ? "Maximum of 3 documents reached." : "Maximum chunk limit reached."}
              </p>
            </div>
          )}

          <input ref={fileInputRef} id="pdf-file-input" type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleFileChange} />

          {fileError && <div style={{ marginTop: "14px" }}><ErrorBanner message={fileError} /></div>}
          {uploadError && <div style={{ marginTop: "14px" }}><ErrorBanner message={uploadError} /></div>}

          {/* Start Chatting Button */}
          {uploadedDocs.length > 0 && (
            <button
              onClick={handleStartChatting}
              style={{
                marginTop: "24px", width: "100%", padding: "14px",
                background: "linear-gradient(to right, #4F46E5, #7C3AED)",
                color: "white", fontSize: "16px", fontWeight: 600,
                border: "none", borderRadius: "12px", cursor: "pointer",
                boxShadow: "0 4px 14px rgba(124,58,237,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
              }}
            >
              <SparklesIcon className="w-5 h-5" style={{ color: "white" }} />
              Start Chatting
            </button>
          )}

          {/* Feature tags */}
          {uploadedDocs.length === 0 && (
            <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid #F3F4F6", display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
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
          )}
        </div>
      </div>
    </div>
  );
}
