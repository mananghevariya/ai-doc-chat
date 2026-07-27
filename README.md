# AI Document Chat

Chat with your PDF documents using AI. Upload a document, ask questions, and get answers grounded in the actual content — with source citations showing exactly which part of the document was used.

**Live Demo:** https://ai-doc-chat-nine.vercel.app  
**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Google Gemini API

---

## Features

- 📄 **PDF Upload & Parsing** — extracts and chunks text from uploaded PDFs (up to 10 MB / ~10 pages)
- 💬 **AI-Powered Q&A** — ask natural language questions, get answers grounded strictly in the document
- 🔍 **Source Citations** — click a source badge to see the exact passage the answer came from
- 💾 **Persistent Sessions** — conversations are saved locally and restored on reload
- ⌨️ **Typewriter Response Animation** — smooth, readable answer reveal
- 📱 **Fully Responsive** — works cleanly on mobile, tablet, and desktop
- 🎨 **Custom Glassmorphism Design** — cohesive luxury-glass visual theme throughout

---

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript 5
- **Styling:** Tailwind CSS v4
- **AI:** Google Gemini API (`@google/generative-ai` v0.24)
- **PDF Parsing:** `pdf-parse` v2
- **Deployment:** Vercel

---

## How It Works

1. User uploads a PDF (up to 10 MB / ~10 pages).
2. Server extracts text using `pdf-parse` and splits it into overlapping ~1000 character chunks.
3. User asks a question — relevant chunks are sent to Gemini with a strict "answer only from this context" instruction.
4. Gemini returns a structured JSON answer plus the specific chunk index number(s) used.
5. UI displays the answer with a typewriter effect and interactive, expandable source badges.

---

## Running Locally

```bash
# 1. Clone the repository
git clone https://github.com/mananghevariya/ai-doc-chat.git
cd ai-doc-chat

# 2. Install dependencies
npm install

# 3. Set up environment variables
# Create a .env.local file in the root directory:
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env.local

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to test the application.
