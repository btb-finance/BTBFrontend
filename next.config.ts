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
    ];
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
