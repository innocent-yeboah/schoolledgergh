import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Outfit, Playfair_Display } from "next/font/google";
import { readAppEnv } from "@/lib/env/app";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const display = Playfair_Display({ subsets: ["latin"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "SchoolLedger GH",
  description: "School fee management for Ghanaian schools.",
  applicationName: "SchoolLedger GH",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SchoolLedger", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#07421F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const appEnv = readAppEnv();
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${display.variable} ${mono.variable} antialiased`}>
        {appEnv === "staging" ? (
          <p role="status" className="bg-gold-100 px-4 py-2 text-center text-sm font-semibold text-ink-900">
            Staging. This is not the production database.
          </p>
        ) : null}
        {children}
      </body>
    </html>
  );
}
