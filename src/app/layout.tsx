import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ProgressProvider } from "@/contexts/ProgressContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Conversor de Vídeos OCFlix",
  description: "Conversor de vídeos para MKV com codec HEVC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        {/* FFmpeg.wasm para conversão no navegador */}
        <Script 
          src="https://unpkg.com/@ffmpeg/ffmpeg@0.12.7/dist/umd/ffmpeg.js"
          strategy="beforeInteractive"
        />
        <Script 
          src="https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js"  
          strategy="beforeInteractive"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ProgressProvider>
          {children}
        </ProgressProvider>
      </body>
    </html>
  );
}
