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
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 10 * 60 * 1000,
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
