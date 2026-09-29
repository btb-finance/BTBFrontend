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
        {/* The Discover snapshot read starts on first JS run; warming the
            connection here saves its DNS and TLS round trips. */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud'} crossOrigin="anonymous"/>
        <JsonLd />
      </head>
      <body>{children}</body>
    </html>
  );
}
