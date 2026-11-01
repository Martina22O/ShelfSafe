import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { hasSupabaseEnv } from "../lib/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShelfSafe",
  description: "ShelfSafe Inventory & Expiry Management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const envConfigured = hasSupabaseEnv();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        {!envConfigured ? (
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="border border-red-300 bg-red-50 p-6 rounded text-red-800 text-center max-w-md">
              <h2 className="text-lg font-bold mb-2">Configuration Error</h2>
              <p>Missing Supabase settings in .env.local</p>
            </div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
