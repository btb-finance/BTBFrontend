import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.20.10.6"],
  async redirects() {
    // Earn moved onto Home. Kept as a redirect rather than a 404 — the path was
    // public and is linked from outside the app.
    return [
      { source: "/token", destination: "/", permanent: false },
      // Trading was retired; the app is about LPs. Old links land on Home.
      { source: "/trade", destination: "/", permanent: false },
      // The comparison pages live at keyword URLs; the first /vs/<slug> form is kept as a redirect.
      { source: "/vs/:slug", destination: "/:slug-alternative", permanent: true },
    ];
  },
  async rewrites() {
    // /metrix-finance-alternative is served by the /vs/[slug] route; the URL the reader sees keeps the keyword.
    return [{ source: "/:slug(metrix-finance|drippy-finance|revert-finance)-alternative", destination: "/vs/:slug" }];
  },
  async headers() {
    return [
      {
        // Safe{Wallet} loads this from app.safe.global to register BTB as a
        // Safe App, and reads it cross-origin, so it needs CORS.
        source: "/manifest.json",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET" },
          { key: "Access-Control-Allow-Headers", value: "X-Requested-With, content-type, Authorization" },
        ],
      },
      {
        // Baseline hardening for every page. No CSP yet: wallet SDKs inject
        // inline scripts and iframes, so a strict policy needs its own pass.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      {
        source: "/chains/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
