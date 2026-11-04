import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Nivaas — Flats, villas and plots in Bangalore, Pune, Mumbai and Murud Janjira", template: "%s · Nivaas" },
  description: "Search homes by locality, BHK and budget. Every listing shows its RERA status, carpet area and possession date, with similar homes nearby.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f3ee" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
