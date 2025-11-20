import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'react-icons',
      '@heroicons/react',
      'framer-motion',
      'ethers',
      'wagmi',
      'viem'
    ],
    optimizeCss: true,
  },
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
  // Reduce bundle size and JavaScript execution
  modularizeImports: {
    '@heroicons/react/24/outline': {
      transform: '@heroicons/react/24/outline/{{member}}',
    },
    'react-icons/fa6': {
      transform: 'react-icons/fa6/{{member}}',
    },
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Optimize bundle size with better code splitting
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      runtimeChunk: 'single',
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 25,
        maxAsyncRequests: 25,
        minSize: 20000,
        cacheGroups: {
          default: false,
          vendors: false,
          // Framework chunk (critical)
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            priority: 50,
            enforce: true,
            reuseExistingChunk: true,
          },
          // Vendor chunk for web3 libraries (lazy load)
          web3: {
            name: 'web3',
            test: /[\\/]node_modules[\\/](ethers|wagmi|viem|@rainbow-me|@wagmi|@coinbase)[\\/]/,
            priority: 40,
            reuseExistingChunk: true,
            chunks: 'async',
          },
          // UI libraries (async)
          ui: {
            name: 'ui',
            test: /[\\/]node_modules[\\/](framer-motion)[\\/]/,
            priority: 30,
            reuseExistingChunk: true,
            chunks: 'async',
          },
          // Icon libraries (async)
          icons: {
            name: 'icons',
            test: /[\\/]node_modules[\\/](lucide-react|react-icons|@heroicons)[\\/]/,
            priority: 25,
            reuseExistingChunk: true,
            chunks: 'async',
          },
          // Common libraries
          lib: {
            test: /[\\/]node_modules[\\/]/,
            name(module: any) {
              const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
              return `lib.${packageName.replace('@', '')}`;
            },
            priority: 10,
            minChunks: 2,
            reuseExistingChunk: true,
          },
        },
      },
    };

    return config;
  },
};

export default nextConfig;
