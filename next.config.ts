import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.20.10.6"],
  // Shareable pool/chain deep links (/discover/<chain>, /discover/<chain>/<pair>)
  // are served by the static /discover page — the client reads the real URL and
  // opens the right pool/chain. This avoids an on-demand SSR function (which
  // crashes rendering the wallet providers server-side).
  async rewrites() {
    return [
      { source: "/discover/:chain", destination: "/discover" },
      { source: "/discover/:chain/:pair", destination: "/discover" },
    ];
  },
};

export default nextConfig;
