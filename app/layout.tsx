import type { Metadata, Viewport } from "next";
import { GOOGLE_FONTS_HREF } from "@/lib/cms/schema";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Nivaas — Find homes by city, locality & configuration", template: "%s · Nivaas" },
  description: "Search verified homes across Bangalore, Murud Janjira, Pune and Mumbai, with full RERA details and similar-property recommendations.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1f3a2e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />
      </head>
      <body>{children}</body>
    </html>
  );
}
