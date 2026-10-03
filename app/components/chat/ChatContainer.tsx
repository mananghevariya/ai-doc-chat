"use client";
import { UserButton } from "@clerk/nextjs";

import React, { useState, useRef, useEffect, FormEvent } from "react";
import { Sparkles, Plus, Search, MessageSquare, PlusCircle, Share, FileText, X, Settings, Sun, Bell, Mic, ArrowUp, Eye, BookOpen, DollarSign, Zap, ListChecks, PanelLeft } from 'lucide-react';
import { ActiveSource, DocInfo, DocumentItem, Message, ChatResponse } from "@/app/types";
import { SpinnerTeal, ErrorBanner, TypingDots } from "../ui/Feedback";
import MessageBubble from "./MessageBubble";

interface ChatContainerProps {
  docInfo: DocInfo;
  setDocInfo: React.Dispatch<React.SetStateAction<DocInfo | null>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onReset: () => void;
  chatId: string | null;
  setChatId: React.Dispatch<React.SetStateAction<string | null>>;
}

function uid() { return Math.random().toString(36).slice(2, 9); }
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const QUICK_PROMPTS = [
  { icon: <BookOpen size={16} />, label: "Summarize Key Takeaways" },
  { icon: <DollarSign size={16} />, label: "Show Financial Highlights" },
  { icon: <Zap size={16} />, label: "Explain Section 4 simply" },
  { icon: <ListChecks size={16} />, label: "Generate Action Checklist" },
];

export default function ChatContainer({
  docInfo, setDocInfo, messages, setMessages, onReset, chatId, setChatId
}: ChatContainerProps) {
  const [inputValue, setInputValue] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [addingDoc, setAddingDoc] = useState(false);
  const [addDocError, setAddDocError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<ActiveSource | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState("gemini-3.8-flash");

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addDocInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/chats/history")
      .then(res => res.json())
      .then(data => {
        if (data.chats) setChatHistory(data.chats);
      })
      .catch(err => console.error("Failed to load chat history", err));
  }, []);

  const handleLoadChat = async (id: string) => {
    setChatId(id);
    try {
      const res = await fetch(`/api/chats/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages);
        }
      }
    } catch (e) {
      console.error("Failed to load chat", e);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  useEffect(() => {
    const el = scrollAreaRef.current;
    const c = messagesContainerRef.current;
    if (!el || !c) return;
    let near = true;
    const onScroll = () => { near = el.scrollHeight - el.scrollTop - el.clientHeight <= 120; };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => { if (near) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); });
    ro.observe(c);
    return () => { el.removeEventListener("scroll", onScroll); ro.disconnect(); };
  }, []);

  // Add this outside or as a ref: 
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setChatLoading(false);
      setIsStreaming(false);
    }
  };

  const sendQuestion = async (q: string) => {
    const question = q.trim();
    if (!question || chatLoading || addingDoc) return;
    
    setInputValue(""); 
    setChatError(null);
    setMessages((p) => [...p, { id: uid(), role: "user", content: question }]);
    
    const msgId = uid();
    setChatLoading(true);
    setIsStreaming(true);
    
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, question, model: selectedModel }),
        signal: abortControllerRef.current.signal,
      });
      
      const returnedChatId = res.headers.get("X-Chat-Id");
      if (returnedChatId && !chatId) {
        setChatId(returnedChatId);
        setChatHistory(prev => {
          if (prev.find(c => c.id === returnedChatId)) return prev;
          return [{
            id: returnedChatId,
            title: question.slice(0, 30) + (question.length > 30 ? "..." : ""),
            createdAt: new Date().toISOString()
          }, ...prev];
        });
      }

      if (!res.ok) { 
        const json = await res.json().catch(() => ({}));
        setChatError(json.error ?? "Failed to generate a response."); 
        setChatLoading(false);
        return; 
      }
      
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No readable stream available.");
      
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let hasSources = false;
      let firstChunkReceived = false;
      let buffer = "";
      
      while (true) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) break;
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          // Keep the last partial line in the buffer
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') {
                break;
              }
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.chatId && !chatId) {
                  setChatId(parsed.chatId);
                }
                if (parsed.error) {
                  setChatError(parsed.error);
                }
                if (parsed.text) {
                  accumulatedText += parsed.text;
                  
                  if (!firstChunkReceived) {
                    firstChunkReceived = true;
                    setChatLoading(false);
                    setMessages((p) => [...p, { id: msgId, role: "assistant", content: accumulatedText, isNew: true }]);
                  }
                  
                  if (!hasSources) {
                    const splitIdx = accumulatedText.indexOf("===SOURCES===");
                    if (splitIdx !== -1) {
                      hasSources = true;
                      const answerText = accumulatedText.substring(0, splitIdx).trim();
                      setMessages((p) => p.map(m => m.id === msgId ? { ...m, content: answerText } : m));
                    } else {
                      setMessages((p) => p.map(m => m.id === msgId ? { ...m, content: accumulatedText } : m));
                    }
                  }
                }
              } catch (e) {
                console.error("Failed to parse SSE line", e, dataStr);
              }
            }
          }
        }
      }
      if (!firstChunkReceived) {
         setChatLoading(false);
         setMessages((p) => [...p, { id: msgId, role: "assistant", content: "No response generated.", isNew: true }]);
      }
      
      if (hasSources) {
        const splitIdx = accumulatedText.indexOf("===SOURCES===");
        if (splitIdx !== -1) {
          const sourceStr = accumulatedText.substring(splitIdx + "===SOURCES===".length).trim();
          try {
            let cleanStr = sourceStr.replace(/```json/g, "").replace(/```/g, "").trim();
            const match = cleanStr.match(/\[([\d\s,]*)\]/);
            let indexes: number[] = [];
            if (match && match[1]) {
              indexes = match[1].split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            } else {
              indexes = JSON.parse(cleanStr);
            }
            setMessages((p) => p.map(m => m.id === msgId ? { ...m, sourceChunkIndexes: indexes } : m));
          } catch (e) {
            console.error("Failed to parse sources:", sourceStr);
          }
        }
      }
      
    } catch (e: any) { 
      if (e.name !== 'AbortError') {
        console.error("Failed to send question", e);
        setChatError("Network error. Please try again."); 
      } else {
        console.log("Stream aborted by user");
      }
      setChatLoading(false);
    } finally { 
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 60); 
    }
  };

  const handleSend = (e: FormEvent) => { e.preventDefault(); sendQuestion(inputValue); };

  const handleAddDocumentFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
    const existingDocs = docInfo.documents?.length ? docInfo.documents : [{ id: uid(), fileName: docInfo.fileName, fileSize: docInfo.fileSize || "1 MB", pageCount: docInfo.pageCount, wordCount: docInfo.wordCount, chunks: docInfo.chunks }];
    if (existingDocs.length >= 3) { setAddDocError("Maximum of 3 documents reached."); return; }
    if (file.type !== "application/pdf") { setAddDocError("Only PDF files are supported."); return; }
    if (file.size > 10 * 1024 * 1024) { setAddDocError("File size exceeds 10 MB."); return; }
    setAddDocError(null); setAddingDoc(true);
    const fd = new FormData(); fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setAddDocError(json.error ?? "Upload failed."); return; }
      const currentTotalChunks = docInfo.chunks.length;
      if (currentTotalChunks + json.chunks.length > 60) {
        setAddDocError(`Adding this document exceeds the maximum 60 chunks allowed for AI context. (Currently: ${currentTotalChunks})`);
        return;
      }
      const tagged = json.chunks.map((c: string) => `[Document: ${file.name}]\n${c}`);
      const newDoc: DocumentItem = { id: uid(), fileName: file.name, fileSize: formatBytes(file.size), pageCount: json.pageCount, wordCount: json.wordCount, chunks: tagged };
      const updatedDocs = [...existingDocs, newDoc];
      setDocInfo({ documents: updatedDocs, chunks: [...docInfo.chunks, ...tagged], pageCount: docInfo.pageCount + json.pageCount, wordCount: docInfo.wordCount + json.wordCount, fileName: `${updatedDocs.length} Documents`, fileSize: docInfo.fileSize });
      setMessages((p) => [...p, { id: uid(), role: "assistant", content: `📄 Added **"${file.name}"** — ${json.pageCount} page${json.pageCount !== 1 ? "s" : ""}, ~${json.wordCount.toLocaleString()} words. Now searching across **${updatedDocs.length}** documents.`, isNew: true }]);
    } catch { setAddDocError("Network error while uploading."); }
    finally { setAddingDoc(false); }
  };

  const handleRemoveDoc = (docId: string) => {
    const docs = docInfo.documents || [];
    if (docs.length <= 1) { onReset(); return; }
    const updated = docs.filter((d) => d.id !== docId);
    const removed = docs.find((d) => d.id === docId);
    setDocInfo({ documents: updated, chunks: updated.flatMap((d) => d.chunks), pageCount: updated.reduce((a, d) => a + d.pageCount, 0), wordCount: updated.reduce((a, d) => a + d.wordCount, 0), fileName: `${updated.length} Documents`, fileSize: updated[0]?.fileSize || "1 MB" });
    if (removed) setMessages((p) => [...p, { id: uid(), role: "assistant", content: `🗑️ Removed **"${removed.fileName}"**. ${updated.length} document${updated.length !== 1 ? "s" : ""} remaining.`, isNew: true }]);
  };

  const handleExportChat = () => {
    if (!messages.length) return;
    let c = `# Chat Export — ${new Date().toLocaleString()}\n\n`;
    messages.forEach((m) => { c += `### ${m.role === "user" ? "👤 You" : "🤖 AI"}\n${m.content}\n\n`; });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([c], { type: "text/markdown" })), download: `chat-${Date.now()}.md` });
    a.click();
  };

  const currentDocs = docInfo.documents?.length ? docInfo.documents : [{ id: "doc-1", fileName: docInfo.fileName, fileSize: docInfo.fileSize || "1 MB", pageCount: docInfo.pageCount, wordCount: docInfo.wordCount, chunks: docInfo.chunks }];
  const canSend = !!inputValue.trim() && !chatLoading && !addingDoc;

  return (
    
    <>
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#fafbfc]">
        
              <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-100/60 rounded-full blur-[100px] opacity-80 mix-blend-multiply">
      </div>
    
      
        <div className="absolute top-1/4 -right-40 w-96 h-96 rounded-xl bg-tertiary-fixed opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-xl bg-primary-fixed opacity-30 blur-3xl"></div>
      </div>

      <aside className={`fixed left-4 top-4 bottom-4 h-[calc(100vh-32px)] ${isCollapsed ? 'w-20' : 'w-64'} bg-white/70 backdrop-blur-[40px] border border-gray-200/50 shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl z-50 flex flex-col p-4 transition-all duration-300`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2 mb-2 transition-all duration-300`}>
          <Sparkles size={18} className="text-[#444746] shrink-0" />
          <span className={`text-[15px] font-medium text-[#1f1f1f] truncate transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>DocuMind</span>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          <button onClick={onReset} className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-center gap-2'} bg-white border border-gray-200/50 hover:bg-gray-50 text-[#1f1f1f] py-2.5 ${isCollapsed ? 'px-0' : 'px-4'} rounded-xl shadow-sm transition-all active:scale-[0.98]`} type="button">
            <Plus size={16} className="shrink-0" />
            <span className={`text-[13px] font-medium transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>New Chat</span>
          </button>
          
          <button onClick={() => addDocInputRef.current?.click()} disabled={addingDoc} className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-center gap-2'} bg-[#0f1115] hover:bg-[#1a1d24] text-white py-2.5 ${isCollapsed ? 'px-0' : 'px-4'} rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.15)] transition-all active:scale-[0.98]`} type="button">
            {addingDoc ? <SpinnerTeal size="sm" /> : <FileText size={16} className="shrink-0" />}
            <span className={`text-[13px] font-medium transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>{addingDoc ? "Uploading..." : "Upload Document"}</span>
          </button>
          <input ref={addDocInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleAddDocumentFile} />
        </div>

        <div className={`mb-4 ${isCollapsed ? 'px-0' : 'px-2'}`}>
          <div className="relative flex items-center justify-center">
            <Search size={16} className={`text-[#444746] transition-all duration-300 ${isCollapsed ? '' : 'absolute left-3'}`} />
            <input className={`transition-all duration-300 bg-transparent text-[#1f1f1f] placeholder:text-[#444746] focus:outline-none focus:bg-[#f0f4f9] border border-transparent focus:border-[#747775] rounded-xl ${isCollapsed ? 'w-0 opacity-0 p-0 overflow-hidden' : 'w-full pl-9 pr-3 py-1.5 hover:bg-[#f0f4f9] text-[13px]'}`} placeholder="Search chats" type="text" tabIndex={isCollapsed ? -1 : 0}/>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto scrollbar-none ${isCollapsed ? 'px-0' : 'px-2'}`}>
          <nav className="flex flex-col gap-1 mb-6">
            <a onClick={handleExportChat} className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2 rounded-xl transition-colors text-[#444746] hover:bg-[#f0f4f9] hover:text-[#1f1f1f] cursor-pointer`} href="#">
              <Share size={16} className="shrink-0" />
              <span className={`text-[13px] transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>Export Chat</span>
            </a>
          </nav>

          <span className={`px-3 text-[11px] font-medium text-[#444746] mb-2 block tracking-wide transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden whitespace-nowrap' : 'opacity-100'}`}>Recent Chats</span>
          <div className="flex flex-col gap-1">
            {chatHistory.map(chat => (
              <div key={chat.id} title={isCollapsed ? chat.title : undefined} onClick={() => handleLoadChat(chat.id)} className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2 rounded-xl hover:bg-[#f0f4f9] text-[#444746] hover:text-[#1f1f1f] transition-colors cursor-pointer group ${chat.id === chatId ? 'bg-[#f0f4f9] text-[#1f1f1f]' : ''}`}>
                <MessageSquare size={16} className="shrink-0" />
                <span className={`text-[13px] truncate flex-1 transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>{chat.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-2">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between p-2'} rounded-xl hover:bg-[#f0f4f9] cursor-pointer transition-colors`}>
            <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
              <div className="w-7 h-7 flex items-center justify-center shrink-0"><UserButton appearance={{ elements: { userButtonAvatarBox: "w-7 h-7" } }} /></div><span className="text-[13px] font-medium text-[#1f1f1f] truncate">User Profile</span>
            </div>
            <button aria-label="Account settings" className={`flex items-center justify-center text-[#444746] hover:text-[#1f1f1f] transition-colors shrink-0 ${isCollapsed ? 'w-full h-full p-2' : 'pr-1'}`} type="button">
              <Settings size={18} className="" />
            </button>
          </div>
        </div>
      </aside>

      <div className={`${isCollapsed ? 'pl-[104px]' : 'pl-[280px]'} flex flex-col h-screen transition-all duration-300`}>
        <header className="flex-shrink-0 h-14 mt-4 mr-4 bg-white/60 backdrop-blur-[40px] rounded-2xl border border-gray-200/50 shadow-[0_4px_16px_rgba(0,0,0,0.03)] z-40 flex items-center justify-between px-6 sticky top-4 transition-all duration-300">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 -ml-2 rounded-xl text-[#444746] hover:bg-[#f0f4f9] transition-colors" aria-label="Toggle sidebar">
              <PanelLeft size={18} />
            </button>
            <div className="flex items-center gap-2 text-[#444746]">
              <FileText size={16} className="" />
              <span className="text-[13px] font-medium text-[#1f1f1f]">{currentDocs.length > 1 ? `${currentDocs.length} Documents` : currentDocs[0].fileName}</span>
              <span className="text-[11px] hidden sm:inline-block">({docInfo.pageCount} Pages)</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select 
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="appearance-none bg-surface-container-low border border-gray-200 text-[#444746] text-[12px] font-medium rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors cursor-pointer"
              >
                <option value="gemini-3.8-flash">⚡ Gemini 3.8 Flash (Fast)</option>
                <option value="gemini-3.7-flash">🧠 Gemini 3.7 Flash</option>
                <option value="gemini-2.5-flash">🚀 Gemini 2.5 Flash</option>
                <option value="gemini-pro-latest">💎 Gemini Pro (Advanced)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#444746]">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
              </div>
            </div>
            <button className="w-8 h-8 rounded-xl flex items-center justify-center text-[#444746] hover:bg-[#f0f4f9] transition-colors" type="button">
              <Sun size={18} className="" />
            </button>
            <button aria-label="Notifications" className="w-8 h-8 rounded-xl flex items-center justify-center text-[#444746] hover:bg-[#f0f4f9] transition-colors" type="button">
              <Bell size={18} className="" />
            </button>
          </div>
        </header>

        {addDocError && (
          <div className="px-gutter pt-4 z-10">
            <ErrorBanner message={addDocError} />
          </div>
        )}

        <main ref={scrollAreaRef} className="flex-1 w-full px-gutter bg-transparent overflow-y-auto">
          <div className="flex flex-col w-full relative min-h-full pb-[200px]">
            <div className="max-w-4xl w-full mx-auto flex flex-col gap-y-space-lg pt-6">
              
              {messages.length === 0 && (
                <section className="w-full bg-white/60 backdrop-blur-3xl p-8 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/80 flex flex-col gap-6 transition-all relative overflow-hidden">
                  <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-2xl"></div>
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md relative z-10">
                    <div className="flex items-center gap-space-md">
                      <div className="w-14 h-14 rounded-2xl bg-primary-fixed flex items-center justify-center shadow-sm text-primary">
                        <FileText size={28} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-space-xs flex-wrap">
                          <span className="font-headline-sm text-headline-sm text-on-surface">{currentDocs.length > 1 ? `${currentDocs.length} Documents` : currentDocs[0].fileName}</span>
                          <span className="px-space-xs py-0.5 rounded-xl bg-secondary-fixed font-label-sm text-label-sm text-on-secondary-fixed">{docInfo.pageCount} pages</span>
                        </div>
                        <div className="flex items-center gap-space-xs mt-0.5 text-on-surface-variant font-body-sm text-body-sm">
                          <span className="w-2 h-2 rounded-xl bg-emerald-500 animate-pulse"></span>
                          <span>Fully Indexed & Verified • ~{docInfo.wordCount.toLocaleString()} words</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-space-xs bg-surface-container-low p-1 rounded-xl self-stretch sm:self-auto justify-end">
                      <button className="flex items-center gap-1 px-space-md py-1.5 rounded-xl bg-surface-container-lowest text-primary shadow-sm hover:bg-surface-container-high transition-all" type="button">
                        <Eye size={16} className="" />
                        <span className="font-label-sm text-label-sm">Inspect Pages</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm pt-space-xs">
                    <div className="bg-surface-container-low/70 rounded-2xl p-space-sm flex flex-col">
                      <span className="font-label-sm text-label-sm text-outline">Confidence Score</span>
                      <span className="font-headline-sm text-headline-sm text-primary font-bold">High</span>
                    </div>
                    <div className="bg-surface-container-low/70 rounded-2xl p-space-sm flex flex-col">
                      <span className="font-label-sm text-label-sm text-outline">Key Citations</span>
                      <span className="font-headline-sm text-headline-sm text-secondary font-bold">Enabled</span>
                    </div>
                    <div className="bg-surface-container-low/70 rounded-2xl p-space-sm flex flex-col">
                      <span className="font-label-sm text-label-sm text-outline">Total Chunks</span>
                      <span className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">{docInfo.chunks.length}</span>
                    </div>
                    <div className="bg-surface-container-low/70 rounded-2xl p-space-sm flex flex-col">
                      <span className="font-label-sm text-label-sm text-outline">Risk Factor</span>
                      <span className="font-headline-sm text-headline-sm text-tertiary font-bold">Low</span>
                    </div>
                  </div>
                </section>
              )}

              <div className="flex flex-col gap-space-lg w-full" ref={messagesContainerRef}>
                {messages.length > 0 && (
                  <div className="flex items-center justify-center">
                    <span className="text-[11px] font-medium text-gray-400 tracking-wider uppercase">
                      Today • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                )}

                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    docInfo={docInfo}
                    activeSource={activeSource}
                    onToggleSource={setActiveSource}
                  />
                ))}

                {chatLoading && (
                  <div className="flex items-start gap-4 w-full">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-800 to-gray-600 flex items-center justify-center shadow-md text-white shrink-0 mt-1">
                      <Sparkles size={16} />
                    </div>
                    <div className="flex-1 py-1 flex flex-col gap-2 transition-all">
                       <div className="flex items-center gap-space-xs mb-1">
                         <span className="font-semibold text-[14px] text-[#1f1f1f] tracking-wide">DocuMind AI</span>
                       </div>
                       <TypingDots />
                    </div>
                  </div>
                )}
                {chatError && !chatLoading && (
                  <div className="py-2">
                    <ErrorBanner message={chatError} />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        </main>

        <div className={`fixed bottom-8 ${isCollapsed ? 'left-[112px]' : 'left-[280px]'} right-0 z-40 px-gutter pointer-events-none flex flex-col items-center transition-all duration-300`}>
          <div className="max-w-3xl w-full flex flex-col gap-space-xs pointer-events-auto">
            {isStreaming && (
              <div className="flex justify-center mb-2">
                <button 
                  onClick={stopGeneration}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 shadow-sm rounded-full text-[13px] font-medium text-gray-700 hover:bg-gray-50 hover:text-red-600 transition-colors"
                  type="button"
                >
                  <X size={16} /> Stop Generation
                </button>
              </div>
            )}
            {messages.length === 0 && !isStreaming && (
              <div className="flex flex-wrap items-center gap-2 py-1 px-1 justify-center">
                {QUICK_PROMPTS.map((p, idx) => {
                  const colors = ["primary", "secondary", "tertiary", "primary"];
                  const color = colors[idx % colors.length];
                  return (
                    <button key={p.label} onClick={() => sendQuestion(p.label)} disabled={chatLoading || addingDoc} className={`inline-flex items-center gap-1.5 px-space-md py-1.5 rounded-xl bg-surface-container-lowest/90 backdrop-blur-md shadow-sm hover:shadow text-on-surface-variant hover:text-${color} hover:bg-surface-container-lowest transition-all shrink-0 text-[13px]`} type="button">
                      <span className={`text-${color}`}>{p.icon}</span>
                      <span className="font-label-md text-label-md">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <form onSubmit={handleSend} className="w-full bg-white/90 backdrop-blur-3xl rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-2 flex items-center gap-2 transition-all border border-white/80 focus-within:border-gray-300 focus-within:shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
              <button onClick={() => addDocInputRef.current?.click()} disabled={addingDoc} aria-label="Add file or context" className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors shrink-0" type="button">
                <Plus size={20} className="" />
              </button>
              <input ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} disabled={chatLoading || addingDoc} className="flex-1 bg-transparent px-space-sm py-2 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none" placeholder={chatLoading ? "Synthesizing query with DocuMind AI..." : `Ask anything about ${currentDocs.length > 1 ? `${currentDocs.length} documents` : currentDocs[0].fileName}...`} type="text"/>
              <button aria-label="Voice input" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0" type="button">
                <Mic size={20} className="" />
              </button>
              <button disabled={!canSend} aria-label="Send query" className="w-10 h-10 rounded-full bg-[#1f1f1f] text-white flex items-center justify-center shadow hover:bg-black transition-all shrink-0 disabled:opacity-30 disabled:hover:scale-100" type="submit">
                {chatLoading ? <SpinnerTeal size="sm" /> : <ArrowUp size={20} className="" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
