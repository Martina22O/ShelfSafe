import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { hasSupabaseEnv } from "../lib/env";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShelfSafe",
  description: "ShelfSafe Inventory & Expiry Management",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
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
      className={`${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f8faf8] text-[#181413]">
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
