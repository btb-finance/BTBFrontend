'use client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { makeConfig } from '@/lib/wagmi';
import { TxProvider } from '@/lib/TxTracker';
import { ReactNode, useState } from 'react';

// Public Convex URL — hardcoded fallback so Netlify SSG doesn't crash when
// NEXT_PUBLIC_CONVEX_URL isn't set in the deploy env. Override via env var.
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud';

export function Providers({ children }: { children: ReactNode }) {
  // Lazy-init via useState so the client constructs once, on first render,
  // not at module load — keeps SSR / static generation from blowing up.
  const [convex]      = useState(() => new ConvexReactClient(CONVEX_URL));
  const [config]      = useState(() => makeConfig());
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // 60s stale window — re-navigating to a screen within that window
        // serves cached wagmi/tanstack data instantly instead of showing the
        // "Loading…" spinner while public RPCs respond again.
        staleTime: 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));
  return (
    <ConvexProvider client={convex}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <TxProvider>
            {children}
          </TxProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ConvexProvider>
  );
}
