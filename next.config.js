/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {},
  serverExternalPackages: [],
  typescript: {
    // Type checking enabled during builds
    ignoreBuildErrors: false,
  }
}

module.exports = nextConfig