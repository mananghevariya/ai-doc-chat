import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Document Chat — Light Liquid Glass Edition",
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
      className={`${fraunces.variable} ${inter.variable} font-sans h-full antialiased text-[#1A1B2E] bg-[#F7F8FC]`}
    >
      <body className="relative min-h-full flex flex-col overflow-x-hidden bg-[#F7F8FC] text-[#1A1B2E]">
        {children}
      </body>
    </html>
  );
}
