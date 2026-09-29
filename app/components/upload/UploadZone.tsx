"use client";

import React, { useState, useRef, useCallback } from "react";
import { DocInfo, DocumentItem } from "@/app/types";
import { SpinnerTeal, ErrorBanner } from "../ui/Feedback";

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
      setSelectedFile(null);
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
    const size = uploadedDocs[0].fileSize;
    
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
    <div className="min-h-screen bg-background relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-secondary-fixed opacity-30 blur-3xl"></div>
        <div className="absolute top-1/4 -right-40 w-[500px] h-[500px] rounded-full bg-tertiary-fixed opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-[700px] h-[400px] rounded-full bg-primary-fixed opacity-30 blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center">
        
        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary-fixed text-primary font-label-md text-label-md font-bold uppercase tracking-widest mb-8 shadow-sm">
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          <span>DocuMind AI</span>
        </div>

        <div className="text-center mb-10">
          <h1 className="font-display text-display text-on-surface mb-4">
            Chat with Your Documents
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md mx-auto">
            Upload up to {MAX_DOCS} PDFs to analyze them simultaneously and get AI-powered answers with exact source citations.
          </p>
        </div>

        <div className="w-full bg-surface-container-lowest/90 backdrop-blur-xl rounded-[2rem] p-6 shadow-lg border border-surface-container">
          
          {uploadedDocs.length > 0 && (
            <div className="mb-6">
              <h3 className="font-label-lg text-label-lg text-on-surface mb-3">
                Uploaded Documents ({uploadedDocs.length}/{MAX_DOCS})
              </h3>
              <div className="flex flex-col gap-3">
                {uploadedDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-surface-container-high transition-colors hover:bg-surface-container">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-[20px]">description</span>
                      </div>
                      <div className="overflow-hidden flex flex-col">
                        <span className="font-label-md text-label-md text-on-surface truncate">{doc.fileName}</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">{doc.pageCount} pages · {doc.fileSize} · {doc.chunks.length} chunks</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemoveDoc(doc.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors shrink-0"
                      title="Remove document"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!limitReached && !chunksLimitReached) ? (
            <div
              role="button"
              tabIndex={0}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !selectedFile && fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && !selectedFile && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center gap-4 text-center cursor-pointer transition-all ${
                isDragging ? "border-primary bg-primary-fixed/30" : 
                selectedFile ? "border-secondary bg-secondary-fixed/20" : 
                "border-outline-variant bg-surface-container-low hover:bg-surface-container hover:border-primary/50"
              }`}
            >
              {selectedFile ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-secondary-fixed flex items-center justify-center text-secondary shadow-sm">
                    <span className="material-symbols-outlined text-[28px]">check_circle</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="font-label-lg text-label-lg text-on-surface max-w-[260px] truncate">
                      {selectedFile.name}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                      {formatBytes(selectedFile.size)} · Ready to analyze
                    </span>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setFileError(null); }}
                      className="px-4 py-2 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors">
                      Cancel
                    </button>
                    <button type="button"
                      disabled={uploading}
                      onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                      className="px-6 py-2 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-md transition-transform active:scale-95 flex items-center gap-2">
                      {uploading ? <SpinnerTeal size="sm" /> : <span className="material-symbols-outlined text-[18px]">upload</span>}
                      {uploading ? "Analyzing..." : "Confirm & Add"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-surface-container-lowest border border-surface-container-high flex items-center justify-center text-primary shadow-sm">
                    <span className="material-symbols-outlined text-[32px]">upload_file</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <p className="font-label-md text-label-md text-on-surface">
                      Drag & drop your PDF here, or <span className="text-primary font-bold">browse</span>
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                      {uploadedDocs.length > 0 ? "Add another document" : "PDF files only"} · Up to {MAX_SIZE_MB} MB
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-6 text-center bg-error-container/30 border border-error-container rounded-3xl">
              <p className="font-label-md text-label-md text-on-error-container">
                {limitReached ? "Maximum of 3 documents reached." : "Maximum chunk limit reached."}
              </p>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />

          {fileError && <div className="mt-4"><ErrorBanner message={fileError} /></div>}
          {uploadError && <div className="mt-4"><ErrorBanner message={uploadError} /></div>}

          {uploadedDocs.length > 0 && (
            <button
              onClick={handleStartChatting}
              className="mt-8 w-full py-4 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg shadow-[0_4px_16px_rgba(70,72,212,0.3)] transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">chat</span>
              Start Chatting
            </button>
          )}

          {uploadedDocs.length === 0 && (
            <div className="mt-8 pt-6 border-t border-surface-container flex flex-wrap gap-3 justify-center">
              {[
                { icon: "library_books", text: "Multi-PDF" },
                { icon: "link", text: "Source Citations" },
                { icon: "bolt", text: "Instant Answers" }
              ].map((t) => (
                <span key={t.text} className="inline-flex items-center gap-1.5 bg-surface-container-low px-4 py-1.5 rounded-full font-label-sm text-label-sm text-on-surface-variant border border-surface-container-high">
                  <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                  {t.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
