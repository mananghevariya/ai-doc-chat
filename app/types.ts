export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourceChunkIndexes?: number[];
  isNew?: boolean;
}

export interface DocumentItem {
  id: string;
  fileName: string;
  fileSize: string;
  pageCount: number;
  wordCount: number;
  chunks: string[];
}

export interface DocInfo {
  documents: DocumentItem[];
  chunks: string[];
  pageCount: number;
  wordCount: number;
  fileName: string;
  fileSize: string;
}

export interface ActiveSource {
  msgId: string;
  chunkIndex: number;
}

export interface UploadResponse {
  chunks: string[];
  pageCount: number;
  wordCount: number;
  error?: string;
}

export interface ChatResponse {
  answer: string;
  sourceChunkIndexes?: number[];
  error?: string;
}

export interface SavedSession {
  docInfo: DocInfo;
  messages: Message[];
  updatedAt: number;
}
