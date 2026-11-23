import type { Metadata, Viewport } from "next";
import { baseMetadata, baseViewport } from "@/lib/seo/metadata";
import { JsonLd } from "@/lib/seo/JsonLd";
import Script from "next/script";
import { chainThemeCss, DEFAULT_CHAIN_THEME } from "@/lib/chainThemes";
import { HumanGate } from "@/components/HumanGate";
import "./globals.css";

// The theme's CSS variables are set by the app (src/lib/ChainThemeContext.tsx) once it runs. The server-rendered
// screen previews paint before that, so the default theme is in the HTML too, light mode included; the inline script
// picks the visitor's saved mode before the first paint. The app's own values override these once it starts.
const cssVars = (mode: "dark" | "light") =>
  Object.entries(chainThemeCss(DEFAULT_CHAIN_THEME, mode)).map(([k, v]) => `${k}:${v}`).join(";");
const THEME_CSS = `:root{${cssVars("dark")}}:root[data-mode="light"]{${cssVars("light")}}`;
const MODE_SCRIPT = `try{if(localStorage.getItem("btb-color-mode")==="light")document.documentElement.dataset.mode="light"}catch(e){}`;
// The site gate (src/components/HumanGate.tsx), decided before the first paint: up unless this browser passed in the
// last 24 hours, or is a search engine or link preview bot (so search results and shared link cards keep working).
const GATE_BOTS = "googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|storebot-google|bingbot|bingpreview|duckduckbot|yandex|baiduspider|applebot|slurp|facebookexternalhit|facebot|twitterbot|telegrambot|discordbot|slackbot|whatsapp|linkedinbot|redditbot|embedly|skypeuripreview|pinterest|ia_archiver";
const GATE_SCRIPT = `(function(){var d=document.documentElement;if(new RegExp("${GATE_BOTS}","i").test(navigator.userAgent))return;var u=0;try{u=+localStorage.getItem("btb-human-until")||0}catch(e){}if(u<Date.now())d.classList.add("btb-gate")})()`;
const GATE_CSS = `#btb-gate{display:none}html.btb-gate{overflow:hidden}html.btb-gate body>*:not(#btb-gate){visibility:hidden}`
  + `html.btb-gate #btb-gate{display:flex;position:fixed;inset:0;z-index:2147483600;align-items:center;justify-content:center;padding:16px;background:#0b0b0d;color:#fff;font:400 15px/1.5 system-ui,sans-serif}`
  + `.btb-gate-card{width:min(400px,100%);text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px}`
  + `.btb-gate-logo{width:56px;height:56px;border-radius:16px;background:#e82534;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;letter-spacing:.5px}`
  + `#btb-gate h1{margin:4px 0 0;font-size:22px;font-weight:700}#btb-gate p{margin:0;color:rgba(255,255,255,.7)}`
  + `.btb-gate-widget{min-height:65px;display:flex;justify-content:center}.btb-gate-status{font-size:13px}`
  + `.btb-gate-retry{margin-top:4px;padding:10px 20px;border-radius:12px;border:0;background:#fff;color:#0b0b0d;font:600 14px system-ui,sans-serif;cursor:pointer}`;

export const metadata: Metadata = baseMetadata;
export const viewport: Viewport = baseViewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }}/>
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }}/>
        <style dangerouslySetInnerHTML={{ __html: GATE_CSS }}/>
        <script dangerouslySetInnerHTML={{ __html: GATE_SCRIPT }}/>
        {/* The Discover snapshot read starts on first JS run; warming the
            connection here saves its DNS and TLS round trips. */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud'} crossOrigin="anonymous"/>
        {/* Cloudflare's human check (src/lib/turnstile.ts): connect early so the check starts without a handshake. */}
        <link rel="preconnect" href="https://challenges.cloudflare.com"/>
        <JsonLd />
      </head>
      <body>
        {children}
        <HumanGate />
        {/* Cloudflare Web Analytics: daily visitors, countries, devices and pages. No cookies, nothing per person; loads after
            the page so it never slows it down. The token is public. */}
        <Script src="https://static.cloudflareinsights.com/beacon.min.js" strategy="afterInteractive" defer
          data-cf-beacon='{"token": "e91f9296229f40d3b865166c06438c09"}'/>
      </body>
    </html>
  );
}
