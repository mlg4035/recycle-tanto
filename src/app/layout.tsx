import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaClientUX } from "@/components/PwaClientUX";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { UploadQueueSync } from "@/components/UploadQueueSync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RecycleTanto",
  description: "Dummy-proof handwritten table scanner",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegister />
        <UploadQueueSync />
        <PwaClientUX />
        {children}
      </body>
    </html>
  );
}
