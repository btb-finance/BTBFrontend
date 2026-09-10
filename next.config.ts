import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.20.10.6"],
  async redirects() {
    // Earn moved onto Home. Kept as a redirect rather than a 404 — the path was
    // public and is linked from outside the app.
    return [{ source: "/token", destination: "/", permanent: false }];
  },
  async headers() {
    return [
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
