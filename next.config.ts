import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'react-icons',
      '@heroicons/react',
      'framer-motion',
      'recharts',
      'ethers',
      'wagmi',
      'viem'
    ],
    // Turbopack is now stable and enabled by default in Next.js 16
    // turbo: {}, // Optional: customize Turbopack settings if needed
  },
  // swcMinify is now default and deprecated in Next.js 16
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Performance optimizations
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Optimize bundle size
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      runtimeChunk: 'single',
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk for web3 libraries
          web3: {
            name: 'web3',
            test: /[\\/]node_modules[\\/](ethers|wagmi|viem|@rainbow-me|@wagmi)[\\/]/,
            priority: 40,
            reuseExistingChunk: true,
          },
          // Framework chunk
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            priority: 50,
            reuseExistingChunk: true,
          },
          // UI libraries
          ui: {
            name: 'ui',
            test: /[\\/]node_modules[\\/](framer-motion|recharts)[\\/]/,
            priority: 30,
            reuseExistingChunk: true,
          },
          // Icon libraries
          icons: {
            name: 'icons',
            test: /[\\/]node_modules[\\/](lucide-react|react-icons|@heroicons)[\\/]/,
            priority: 25,
            reuseExistingChunk: true,
          },
          // Common libraries
          lib: {
            test: /[\\/]node_modules[\\/]/,
            name: 'lib',
            priority: 10,
            minChunks: 1,
            reuseExistingChunk: true,
          },
        },
      },
    };

    return config;
  },
};

export default nextConfig;
