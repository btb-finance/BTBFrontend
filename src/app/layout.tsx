import type { Metadata, Viewport } from "next";
import { baseMetadata, baseViewport } from "@/lib/seo/metadata";
import { JsonLd } from "@/lib/seo/JsonLd";
import Script from "next/script";
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
      <body>
        {children}
        {/* Cloudflare Web Analytics: daily visitors, countries, devices and pages. No cookies, nothing per person; loads after
            the page so it never slows it down. The token is public. */}
        <Script src="https://static.cloudflareinsights.com/beacon.min.js" strategy="afterInteractive" defer
          data-cf-beacon='{"token": "e91f9296229f40d3b865166c06438c09"}'/>
      </body>
    </html>
  );
}
