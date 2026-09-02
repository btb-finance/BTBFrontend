'use client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { makeConfig } from '@/lib/wagmi';
import { TxProvider } from '@/lib/TxTracker';
import { ReactNode, useState, useEffect } from 'react';
import { ChainThemeProvider } from '@/lib/ChainThemeContext';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud';

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [convex]      = useState(() => new ConvexReactClient(CONVEX_URL));
  const [config]      = useState(() => makeConfig());
  // Caching is tiered on purpose. The default below is the shared/slow tier:
  // data that is the same for every visitor and safe to reuse for half an hour
  // — most of which now comes from a Convex snapshot rather than this cache at
  // all (convex/crons.ts, src/lib/cacheKeys.ts).
  //
  // Anything that must be fresher overrides it at the call site and is meant
  // to: per-wallet balances (src/lib/appData.ts, TokenStore) run short and are
  // invalidated after a trade, and swap quotes, tx receipts, pool-safety probes
  // and the launch feed keep their own second-scale intervals. Raising this
  // default must never be read as permission to let those go stale.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  // WalletConnect uses indexedDB which doesn't exist in the serverless
  // (Node.js) runtime. Skip rendering wagmi/convex providers on the server
  // and wait until the client mounts.
  if (!mounted) {
    return null;
  }

  return (
    <ConvexProvider client={convex}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ChainThemeProvider>
            <TxProvider>
              {children}
            </TxProvider>
          </ChainThemeProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ConvexProvider>
  );
}
