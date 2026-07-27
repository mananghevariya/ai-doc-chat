import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocChat AI — Document Intelligence",
  description:
    "Upload PDFs and chat with your documents using Gemini AI. Get instant, accurate answers with source citations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body style={{ height: "100%", maxHeight: "100vh", overflow: "hidden", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
