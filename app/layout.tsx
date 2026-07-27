import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Document Chat — Luxury Glass Edition",
  description:
    "Upload PDFs and chat with your documents using Gemini AI. Get instant, accurate answers from your files.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${jakarta.variable} font-sans h-full antialiased text-[#F0EEF6] bg-[#0B0B1E]`}
    >
      <body className="relative min-h-full flex flex-col overflow-x-hidden bg-gradient-to-br from-[#0B0B1E] via-[#0F0F2D] to-[#14142B] text-[#F0EEF6]">
        {children}
      </body>
    </html>
  );
}
