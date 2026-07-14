'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useConnection, useDisconnect, useSwitchChain, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { prefetchDiscoverPools } from '../lib/discoverPools';
import { prefetchYearnVaults } from '../lib/yearn';
import { pathFor, parsePath, type Overlay } from '../lib/routes';
import { CONTRACTS } from '../lib/wagmi';
import { Spinner } from './Spinner';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Tab } from './types';
import { ConnectScreen } from './screens/ConnectScreen';
import { HomeScreen } from './screens/HomeScreen';
import { DiscoverScreen } from './screens/DiscoverScreen';
import { TokenScreen } from './screens/TokenScreen';
import { SimulateScreen } from './screens/SimulateScreen';
import { SwapScreen } from './screens/SwapScreen';
import { PortfolioScreen } from './screens/PortfolioScreen';
import { NFTScreen } from './screens/NFTScreen';
import { StakeScreen } from './screens/StakeScreen';
import { ReceiveModal } from './ReceiveModal';
import { SendModal } from './SendModal';
import { DocsScreen } from './screens/DocsScreen';
import { EarnScreen } from './screens/EarnScreen';
import { btb } from './design-tokens';
import { TokenStoreProvider, Token } from '../lib/TokenStore';
import { usePreloadBear } from '../lib/preloadBear';
import { SidebarProvider, useSidebar } from '../lib/SidebarContext';

function AppShell({ effectiveAddress, isReadOnly, onImportAddress, onLeave }: {
  effectiveAddress?: string;
  isReadOnly: boolean;
  onImportAddress: (addr: string) => void;
  onLeave: () => void;
}) {
  // Screen + overlay are seeded from the URL (each tab has a real path, e.g.
  // /discover, /token, /earn) and kept in sync via pushState/popstate below.
  const initialRoute = parsePath(usePathname() ?? '/');
  const [screen, setScreen]   = useState<Tab>(initialRoute.screen);
  const [overlay, setOverlay] = useState<Overlay>(initialRoute.overlay);
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend]       = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [sendToken, setSendToken]     = useState<Token | undefined>();
  const [swapToken, setSwapToken]     = useState<Token | undefined>();

  // Warm the BearNFT/BearStaking reads while the user is anywhere in the app so
  // the NFT/Agent tab is instant when they open it.
  usePreloadBear(effectiveAddress);

  const { isMobile } = useSidebar();
  const config = useConfig();

  // Warm the heavy tab data (Discover pools, Yearn vaults) in the background
  // right after the shell mounts, so those tabs open instantly instead of
  // starting their fetches on first visit. Both prefetchers no-op when the
  // data is already fresh or in flight.
  useEffect(() => {
    prefetchDiscoverPools(getPublicClient(config));
    prefetchYearnVaults();
  }, [config]);

  // Push a history entry whenever navigation changes the visible view, and
  // restore state when the user hits back/forward.
  const syncUrl = (s: Tab, o: Overlay) => {
    const path = pathFor(s, o);
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
  };
  useEffect(() => {
    const onPop = () => {
      const r = parsePath(window.location.pathname);
      setScreen(r.screen);
      setOverlay(r.overlay);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Switching tabs also closes any overlay (Earn/Docs) so navigation always
  // does something visible — especially important for the mobile bottom nav.
  const goto = (t: Tab) => { if (t === 'swap') setSwapToken(undefined); setOverlay(null); setScreen(t); syncUrl(t, null); };
  const openOverlay = (o: Exclude<Overlay, null>) => { setOverlay(o); syncUrl(screen, o); };
  const closeOverlay = () => { setOverlay(null); syncUrl(screen, null); };

  // Open the swap tab with a preselected pair and a URL that carries it
  // (/swap?from=…&to=…), so the destination is fully linkable.
  const openSwap = (opts?: { from?: Token; toAddress?: string }) => {
    setSwapToken(opts?.from);
    setOverlay(null);
    setScreen('swap');
    const q = new URLSearchParams();
    if (opts?.from) q.set('from', opts.from.address);
    if (opts?.toAddress) q.set('to', opts.toAddress);
    const path = q.size > 0 ? `/swap?${q}` : '/swap';
    if (window.location.pathname + window.location.search !== path) window.history.pushState(null, '', path);
  };

  const handleLeave = () => { onLeave(); setScreen('home'); syncUrl('home', null); };

  // Actions that need a wallet fall back to opening the connect modal instead
  // of gating the whole app — browsing (Discover, Dashboard, Portfolio in
  // read-only mode) never requires signing in.
  const requireWallet = (fn: () => void) => () => { effectiveAddress ? fn() : setShowConnect(true); };

  const content = (() => {
    switch (screen) {
      case 'home':      return <HomeScreen goto={goto} address={effectiveAddress}
                          onDisconnect={handleLeave}
                          onReceive={requireWallet(() => setShowReceive(true))} onSend={requireWallet(() => setShowSend(true))}
                          onDocs={() => openOverlay('docs')} onEarn={() => openOverlay('earn')}
                          onConnectWallet={() => setShowConnect(true)}/>;
      case 'discover':  return <DiscoverScreen/>;
      case 'token':     return <TokenScreen onSwap={() => openSwap({ toAddress: CONTRACTS.BTB })}/>;
      case 'simulate':  return <SimulateScreen/>;
      case 'swap':      return <SwapScreen initialFrom={swapToken} onConnectWallet={() => setShowConnect(true)}/>;
      case 'portfolio': return <PortfolioScreen onSend={(t) => { setSendToken(t); requireWallet(() => setShowSend(true))(); }} onSwap={(t) => openSwap({ from: t })} onOpenEarn={() => openOverlay('earn')}/>;
      case 'nft':       return <NFTScreen/>;
      case 'stake':     return <StakeScreen onGetBtb={() => openSwap({ toAddress: CONTRACTS.BTB })}/>;
    }
  })();

  const overlayContent = overlay === 'docs'
    ? <DocsScreen onBack={closeOverlay}/>
    : overlay === 'earn'
    ? <EarnScreen onBack={closeOverlay} address={effectiveAddress} onConnect={() => setShowConnect(true)}/>
    : null;

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: btb.bg, display: 'flex' }}>
      {!isMobile && (
        <Sidebar
          tab={screen}
          setTab={goto}
          address={effectiveAddress}
          isReadOnly={isReadOnly}
          onDisconnect={handleLeave}
          onDocs={() => openOverlay('docs')}
          onEarn={() => openOverlay('earn')}
          onConnect={() => setShowConnect(true)}
        />
      )}
      <div style={{
        flex: 1, minWidth: 0, overflowY: 'auto',
        padding: isMobile ? '18px 14px calc(96px + env(safe-area-inset-bottom))' : '32px clamp(16px, 3vw, 40px) 60px',
      }}>
        {overlayContent ?? content}
      </div>
      {isMobile && (
        <MobileNav
          tab={screen}
          setTab={goto}
          address={effectiveAddress}
          isReadOnly={isReadOnly}
          onEarn={() => openOverlay('earn')}
          onDocs={() => openOverlay('docs')}
          onConnect={() => setShowConnect(true)}
          onDisconnect={handleLeave}
        />
      )}
      {showReceive && <ReceiveModal address={effectiveAddress ?? '0x0000000000000000000000000000000000000000'} onClose={() => setShowReceive(false)}/>}
      {showSend    && <SendModal fromAddress={effectiveAddress ?? '0x0000000000000000000000000000000000000000'} onClose={() => { setShowSend(false); setSendToken(undefined); }} initialToken={sendToken}/>}
      {showConnect && (
        <ConnectScreen
          onConnect={() => setShowConnect(false)}
          onImport={(a) => { onImportAddress(a); setShowConnect(false); }}
          onClose={() => setShowConnect(false)}
        />
      )}
    </div>
  );
}

export function MiniApp() {
  const [mounted, setMounted] = useState(false);
  const { address, chainId, status } = useConnection();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  // Read-only address — set when the user "imports" a wallet without connecting.
  // Falls back to the connected wagmi address when both are present.
  const [readOnlyAddress, setReadOnlyAddress] = useState<string | undefined>();
  useEffect(() => { setMounted(true); }, []);

  // The app lives entirely on Ethereum mainnet. Locking the wagmi config to
  // chain 1 only changes how the app reads/writes — it does NOT move the
  // wallet. If the wallet connects on another network (Polygon, BSC, Base…),
  // nudge it back to mainnet so transactions prompt on the right chain.
  useEffect(() => {
    if (status === 'connected' && chainId !== 1) switchChain({ chainId: 1 });
  }, [status, chainId, switchChain]);

  const effectiveAddress = address ?? readOnlyAddress;
  const isReadOnly = !address && !!readOnlyAddress;

  const handleLeave = () => {
    if (address) disconnect();
    setReadOnlyAddress(undefined);
  };

  if (!mounted) return (
    <div style={{ minHeight: '100vh', background: btb.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={48} color="#FFFFFF" track="rgba(255,255,255,0.18)" style={{ borderWidth: 3 }}/>
    </div>
  );

  return (
    <TokenStoreProvider walletAddress={effectiveAddress}>
      <SidebarProvider>
        <AppShell
          effectiveAddress={effectiveAddress}
          isReadOnly={isReadOnly}
          onImportAddress={setReadOnlyAddress}
          onLeave={handleLeave}
        />
      </SidebarProvider>
    </TokenStoreProvider>
  );
}
