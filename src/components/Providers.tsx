'use client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { makeConfig } from '@/lib/wagmi';
import { TxProvider } from '@/lib/TxTracker';
import { ReactNode, useEffect, useState } from 'react';
import { AppSkeleton } from '@/components/AppSkeleton';
import { ChainThemeProvider } from '@/lib/ChainThemeContext';
import { XpToastProvider } from '@/lib/XpToast';
import { SafeAutoConnect } from '@/lib/SafeAutoConnect';
import { setLiveRpcs, type LiveRpc } from '@/lib/chainRpc';
import { api } from '../../convex/_generated/api';

/** The tested RPC lists (convex/rpcHealth.ts) as this browser last saw them; used for up to a week. */
const RPC_KEY = 'btb.rpcs';
const RPC_MAX_AGE_MS = 7 * 86_400_000;
type RpcLists = { chainId: number; endpoints: LiveRpc[] }[];

function installCachedRpcs() {
  try {
    const saved = JSON.parse(localStorage.getItem(RPC_KEY) ?? 'null') as { at: number; lists: RpcLists } | null;
    if (saved && Date.now() - saved.at < RPC_MAX_AGE_MS) setLiveRpcs(saved.lists, true);
  } catch { /* the hardcoded lists stay */ }
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud';

export function Providers({ children }: { children: ReactNode }) {
  const [convex]      = useState(() => new ConvexReactClient(CONVEX_URL));
  // The wallet config is built once, so the tested lists it uses are the ones saved on the last visit; the fresh ones
  // fetched below are saved for the next load (and already used by reads created after they arrive).
  const [config]      = useState(() => { installCachedRpcs(); return makeConfig(); });
  useEffect(() => {
    convex.query(api.rpcHealth.list, {}).then((lists: RpcLists) => {
      if (!lists.length) return;
      setLiveRpcs(lists, true);
      try { localStorage.setItem(RPC_KEY, JSON.stringify({ at: Date.now(), lists })); } catch { /* private mode */ }
    }).catch(() => { /* keep what is installed */ });
  }, [convex]);
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

  // Start wagmi one render after mount, not on the first one. Its reconnect looks for the wallet used last among
  // the connectors it knows at that moment; on the very first render, browser extensions (MetaMask, Rabby, ...)
  // have not announced themselves yet, so the reconnect found nothing and every refresh came up disconnected.
  // Server rendering never reaches here (ClientOnly loads AppShell with ssr:false); this wait is only about timing.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-time mount flag is the point
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <AppSkeleton/>;

  return (
    <ConvexProvider client={convex}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ChainThemeProvider>
            <TxProvider>
              <SafeAutoConnect/>
              <XpToastProvider>{children}</XpToastProvider>
            </TxProvider>
          </ChainThemeProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ConvexProvider>
  );
}
