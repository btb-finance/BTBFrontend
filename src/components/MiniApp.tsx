'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useConnection, useDisconnect, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { prefetchDiscoverPools } from '../lib/discoverPools';
import { pathFor, parsePath, type Overlay } from '../lib/routes';
import { CONTRACTS } from '../lib/wagmi';
import { Spinner } from './Spinner';
import { TopNav } from './TopNav';
import { MobileNav } from './MobileNav';
import { Tab } from './types';
import { MOBILE_GUTTER } from './design-tokens';
import { captureReferral } from '../lib/referral';
import { TokenStoreProvider, Token } from '../lib/TokenStore';
import { usePreloadBear } from '../lib/preloadBear';
import { SidebarProvider, useSidebar } from '../lib/SidebarContext';

// Each screen, overlay and modal is its own chunk. Bundled together they were
// ~900 KB that every visitor downloaded before the first paint, whatever tab
// they opened. The loaders are kept so the idle warmup below can reuse them.
const screenLoader = {
  home:      () => import('./screens/HomeScreen'),
  discover:  () => import('./screens/DiscoverScreen'),
  simulate:  () => import('./screens/SimulateScreen'),
  swap:      () => import('./screens/SwapScreen'),
  portfolio: () => import('./screens/PortfolioScreen'),
  nft:       () => import('./screens/NFTScreen'),
  stake:     () => import('./screens/StakeScreen'),
  docs:      () => import('./screens/DocsScreen'),
  connect:   () => import('./screens/ConnectScreen'),
  agentDock: () => import('./AgentDock'),
  send:      () => import('./SendModal'),
  receive:   () => import('./ReceiveModal'),
};

const ScreenLoading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
    <Spinner size={32} color="var(--btb-text)" track="rgba(var(--fg-rgb), 0.18)"/>
  </div>
);

const HomeScreen      = dynamic(() => screenLoader.home().then(m => m.HomeScreen), { ssr: false, loading: ScreenLoading });
const DiscoverScreen  = dynamic(() => screenLoader.discover().then(m => m.DiscoverScreen), { ssr: false, loading: ScreenLoading });
const SimulateScreen  = dynamic(() => screenLoader.simulate().then(m => m.SimulateScreen), { ssr: false, loading: ScreenLoading });
const SwapScreen      = dynamic(() => screenLoader.swap().then(m => m.SwapScreen), { ssr: false, loading: ScreenLoading });
const PortfolioScreen = dynamic(() => screenLoader.portfolio().then(m => m.PortfolioScreen), { ssr: false, loading: ScreenLoading });
const NFTScreen       = dynamic(() => screenLoader.nft().then(m => m.NFTScreen), { ssr: false, loading: ScreenLoading });
const StakeScreen     = dynamic(() => screenLoader.stake().then(m => m.StakeScreen), { ssr: false, loading: ScreenLoading });
const DocsScreen      = dynamic(() => screenLoader.docs().then(m => m.DocsScreen), { ssr: false, loading: ScreenLoading });
// Treasury only tool: never warmed, fetched only when someone opens it.
const OposSeedScreen  = dynamic(() => import('./screens/OposSeedScreen').then(m => m.OposSeedScreen), { ssr: false, loading: ScreenLoading });
const OposPairsScreen = dynamic(() => import('./screens/OposPairsScreen').then(m => m.OposPairsScreen), { ssr: false, loading: ScreenLoading });
const ConnectScreen   = dynamic(() => screenLoader.connect().then(m => m.ConnectScreen), { ssr: false });
const AgentDock       = dynamic(() => screenLoader.agentDock().then(m => m.AgentDock), { ssr: false });
const SendModal       = dynamic(() => screenLoader.send().then(m => m.SendModal), { ssr: false });
const ReceiveModal    = dynamic(() => screenLoader.receive().then(m => m.ReceiveModal), { ssr: false });

// Once the first screen is up, fetch the rest one at a time while the browser
// is idle, so later tab switches and the connect sheet still open instantly.
function useWarmScreens() {
  useEffect(() => {
    let cancelled = false;
    const idle = (fn: () => void) =>
      typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500);
    const queue = Object.values(screenLoader);
    const next = () => {
      const load = queue.shift();
      if (cancelled || !load) return;
      load().catch(() => {}).finally(() => idle(next));
    };
    idle(next);
    return () => { cancelled = true; };
  }, []);
}

function AppShell({ effectiveAddress, isReadOnly, onImportAddress, onLeave, onViewAddress }: {
  effectiveAddress?: string;
  isReadOnly: boolean;
  onImportAddress: (addr: string) => void;
  onLeave: () => void;
  onViewAddress: (addr: string | undefined) => void;
}) {
  // Screen + overlay are seeded from the URL (each tab has a real path, e.g.
  // /discover, /token, /docs) and kept in sync via pushState/popstate below.
  const initialRoute = parsePath(usePathname() ?? '/');
  const [screen, setScreen]   = useState<Tab>(initialRoute.screen);
  const [overlay, setOverlay] = useState<Overlay>(initialRoute.overlay);
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend]       = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [sendToken, setSendToken]     = useState<Token | undefined>();
  const [swapToken, setSwapToken]     = useState<Token | undefined>();
  const [swapKey, setSwapKey]         = useState(0);

  // Warm the BearNFT/BearStaking reads while the user is anywhere in the app so
  // the NFT/Agent tab is instant when they open it.
  usePreloadBear(effectiveAddress);
  useWarmScreens();

  const { isMobile } = useSidebar();
  const config = useConfig();

  // Warm the Discover pool list in the background right after the shell
  // mounts, so the tab opens instantly instead of starting its fetch on first
  // visit. The prefetcher no-ops when the snapshot is already fresh or in
  // flight.
  useEffect(() => {
    prefetchDiscoverPools(getPublicClient(config));
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

  // Switching tabs also closes any overlay (Docs) so navigation always
  // does something visible — especially important for the mobile bottom nav.
  const goto = (t: Tab) => { if (t === 'swap') setSwapToken(undefined); setOverlay(null); setScreen(t); syncUrl(t, null); };
  const openOverlay = (o: Exclude<Overlay, null>) => { setOverlay(o); syncUrl(screen, o); };
  const closeOverlay = () => { setOverlay(null); syncUrl(screen, null); };

  // Open the Simulate tab on the token's chain with it preselected
  // (/simulate?chain=…&tokenA=…); the finder pairs it with the chain's stable
  // or native token and searches every DEX it knows on that chain.
  const openSimulate = (t: Token) => {
    setOverlay(null);
    setScreen('simulate');
    const q = new URLSearchParams({ chain: String(t.chainId ?? 1), tokenA: t.address });
    window.history.pushState(null, '', `/simulate?${q}`);
  };

  // Open the swap tab with a preselected pair and a URL that carries it
  // (/swap?from=…&to=…), so the destination is fully linkable.
  const openSwap = (opts?: { from?: Token; toAddress?: string }) => {
    setSwapToken(opts?.from);
    // A fresh swap screen reads the new pair from the URL, even when the swap tab is already open.
    setSwapKey((k) => k + 1);
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
                          onConnectWallet={() => setShowConnect(true)}
                          onBuyBtb={() => openSwap({ toAddress: CONTRACTS.BTB })}/>;
      case 'discover':  return <DiscoverScreen/>;
      case 'simulate':  return <SimulateScreen/>;
      case 'swap':      return <SwapScreen key={swapKey} initialFrom={swapToken} onConnectWallet={() => setShowConnect(true)}/>;
      case 'portfolio': return <PortfolioScreen onSend={requireWallet(() => setShowSend(true))} onSwap={(t) => openSwap({ from: t })} onSimulate={openSimulate} viewAddress={effectiveAddress} onViewAddress={onViewAddress}/>;
      case 'nft':       return <NFTScreen/>;
      case 'stake':     return <StakeScreen onGetBtb={() => openSwap({ toAddress: CONTRACTS.BTB })}/>;
    }
  })();

  const overlayContent = overlay === 'docs'
    ? <DocsScreen onBack={closeOverlay}/>
    : overlay === 'opos-seed'
    ? <OposSeedScreen/>
    : overlay === 'opos-pairs'
    ? <OposPairsScreen/>
    : null;

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: 'var(--chain-app-background, #0A0A0F)', display: 'flex', flexDirection: 'column', transition: 'background 280ms ease' }}>
      {!isMobile && (
        <TopNav
          tab={screen}
          setTab={goto}
          address={effectiveAddress}
          isReadOnly={isReadOnly}
          onViewAddress={onViewAddress}
          onDisconnect={handleLeave}
          onDocs={() => openOverlay('docs')}
          onConnect={() => setShowConnect(true)}
        />
      )}
      <div style={{
        flex: 1, minWidth: 0,
        width: '100%', maxWidth: isMobile ? undefined : 1360, margin: isMobile ? undefined : '0 auto',
        padding: isMobile ? `14px ${MOBILE_GUTTER}px calc(86px + env(safe-area-inset-bottom))` : '28px clamp(16px, 3vw, 40px) 60px',
      }}>
        {overlayContent ?? content}
      </div>
      {isMobile && (
        <MobileNav
          tab={screen}
          setTab={goto}
          address={effectiveAddress}
          isReadOnly={isReadOnly}
          onViewAddress={onViewAddress}
          onDocs={() => openOverlay('docs')}
          onConnect={() => setShowConnect(true)}
          onDisconnect={handleLeave}
        />
      )}
      <AgentDock hidden={screen === 'stake' || !!overlay} onConnect={() => setShowConnect(true)} onGetBtb={() => openSwap({ toAddress: CONTRACTS.BTB })}/>
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
  // An invite link (?ref=0x…) is remembered in this browser until the new wallet confirms it.
  useEffect(() => { captureReferral(); }, []);
  const { address } = useConnection();
  const { disconnect } = useDisconnect();
  // Read-only address — set when the user "imports" a wallet without connecting.
  // Falls back to the connected wagmi address when both are present.
  const [readOnlyAddress, setReadOnlyAddress] = useState<string | undefined>();
  // A linked wallet the user chose to look at while connected with another
  // one: everything reads as that wallet, transactions stay disabled.
  const [viewAddress, setViewAddress] = useState<string | undefined>();
  // The viewed wallet belongs to the connected one: switching wallets drops it in this render, not an effect later.
  const [viewFor, setViewFor] = useState(address);
  if (viewFor !== address) { setViewFor(address); setViewAddress(undefined); }

  const viewing = viewAddress && address && viewAddress.toLowerCase() !== address.toLowerCase() ? viewAddress : undefined;
  const effectiveAddress = viewing ?? address ?? readOnlyAddress;
  const isReadOnly = !!viewing || (!address && !!readOnlyAddress);

  const handleLeave = () => {
    if (address) disconnect();
    setReadOnlyAddress(undefined);
    setViewAddress(undefined);
  };

  return (
    <TokenStoreProvider walletAddress={effectiveAddress}>
      <SidebarProvider>
        <AppShell
          effectiveAddress={effectiveAddress}
          isReadOnly={isReadOnly}
          onImportAddress={setReadOnlyAddress}
          onLeave={handleLeave}
          onViewAddress={setViewAddress}
        />
      </SidebarProvider>
    </TokenStoreProvider>
  );
}
