import type { Metadata, Viewport } from "next";
import { baseMetadata, baseViewport } from "@/lib/seo/metadata";
import { JsonLd } from "@/lib/seo/JsonLd";
import Script from "next/script";
import { chainThemeCss, DEFAULT_CHAIN_THEME } from "@/lib/chainThemes";
import "./globals.css";

// The theme's CSS variables are set by the app (src/lib/ChainThemeContext.tsx) once it runs. The server-rendered
// screen previews paint before that, so the default theme is in the HTML too, light mode included; the inline script
// picks the visitor's saved mode before the first paint. The app's own values override these once it starts.
const cssVars = (mode: "dark" | "light") =>
  Object.entries(chainThemeCss(DEFAULT_CHAIN_THEME, mode)).map(([k, v]) => `${k}:${v}`).join(";");
const THEME_CSS = `:root{${cssVars("dark")}}:root[data-mode="light"]{${cssVars("light")}}`;
const MODE_SCRIPT = `try{if(localStorage.getItem("btb-color-mode")==="light")document.documentElement.dataset.mode="light"}catch(e){}`;

export const metadata: Metadata = baseMetadata;
export const viewport: Viewport = baseViewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }}/>
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }}/>
        {/* The Discover snapshot read starts on first JS run; warming the
            connection here saves its DNS and TLS round trips. */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud'} crossOrigin="anonymous"/>
        {/* Cloudflare's human check (src/lib/turnstile.ts): connect early so the check starts without a handshake. */}
        <link rel="preconnect" href="https://challenges.cloudflare.com"/>
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
