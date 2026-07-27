export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourceChunkIndexes?: number[];
  isNew?: boolean; // Used to trigger typewriter animation for fresh assistant messages
}

export interface DocInfo {
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
