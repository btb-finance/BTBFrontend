import type { Metadata, Viewport } from "next";
import { baseMetadata, baseViewport } from "@/lib/seo/metadata";
import { JsonLd } from "@/lib/seo/JsonLd";
import "./globals.css";

export const metadata: Metadata = baseMetadata;
export const viewport: Viewport = baseViewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <JsonLd />
      </head>
      <body>{children}</body>
    </html>
  );
}
