/** @type {import('next').NextConfig} */

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  reactStrictMode: true,
  experimental: {},
  serverExternalPackages: [],
  typescript: {
    // Type checking enabled during builds
    ignoreBuildErrors: false,
  }
}

module.exports = withBundleAnalyzer(nextConfig)