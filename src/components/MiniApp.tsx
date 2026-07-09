'use client';
import { useState, useEffect } from 'react';
import { useConnection, useDisconnect, useSwitchChain } from 'wagmi';
import { Spinner } from './Spinner';
import { Sidebar } from './Sidebar';
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
import { ProductsScreen } from './screens/ProductsScreen';
import { ProtocolCategoryScreen, ProtocolDetailScreen, ProtocolCategory } from './screens/ProtocolScreen';
import { btb } from './design-tokens';
import { TokenStoreProvider, Token } from '../lib/TokenStore';
import { usePreloadBear } from '../lib/preloadBear';
import { SidebarProvider } from '../lib/SidebarContext';

const PAGE_META: Record<Tab, { title: string; subtitle: string }> = {
  home:      { title: 'Dashboard', subtitle: 'Your balances at a glance' },
  discover:  { title: 'Discover',  subtitle: 'Find the best performing pools' },
  token:     { title: 'BTB Token', subtitle: 'The token powering the BTB ecosystem' },
  simulate:  { title: 'Simulate',  subtitle: 'Estimate LP earnings for any pool' },
  swap:      { title: 'Swap',      subtitle: 'Trade tokens instantly' },
  portfolio: { title: 'Portfolio', subtitle: 'Tokens and LP positions' },
  nft:       { title: 'NFT',       subtitle: 'BTB Bear NFT & staking' },
  stake:     { title: 'Agent',     subtitle: 'Automated strategies' },
};

function AppShell({ effectiveAddress, isReadOnly, onImportAddress, onLeave }: {
  effectiveAddress?: string;
  isReadOnly: boolean;
  onImportAddress: (addr: string) => void;
  onLeave: () => void;
}) {
  const [screen, setScreen]   = useState<Tab>('home');
  const [overlay, setOverlay] = useState<'docs' | 'products' | null>(null);
  const [protocolCategory, setProtocolCategory] = useState<ProtocolCategory | null>(null);
  const [protocolId, setProtocolId] = useState<string | null>(null);
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend]       = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [sendToken, setSendToken]     = useState<Token | undefined>();
  const [swapToken, setSwapToken]     = useState<Token | undefined>();

  // Warm the BearNFT/BearStaking reads while the user is anywhere in the app so
  // the NFT/Agent tab is instant when they open it.
  usePreloadBear(effectiveAddress);

  const goto = (t: Tab) => { if (t === 'swap') setSwapToken(undefined); setScreen(t); };

  const handleLeave = () => { onLeave(); setScreen('home'); };

  // Actions that need a wallet fall back to opening the connect modal instead
  // of gating the whole app — browsing (Discover, Dashboard, Portfolio in
  // read-only mode) never requires signing in.
  const requireWallet = (fn: () => void) => () => { effectiveAddress ? fn() : setShowConnect(true); };

  const content = (() => {
    switch (screen) {
      case 'home':      return <HomeScreen goto={goto} address={effectiveAddress}
                          onDisconnect={handleLeave}
                          onReceive={requireWallet(() => setShowReceive(true))} onSend={requireWallet(() => setShowSend(true))}
                          onDocs={() => setOverlay('docs')} onProducts={() => setOverlay('products')}
                          onConnectWallet={() => setShowConnect(true)}/>;
      case 'discover':  return <DiscoverScreen/>;
      case 'token':     return <TokenScreen onSwap={() => setScreen('swap')}/>;
      case 'simulate':  return <SimulateScreen/>;
      case 'swap':      return <SwapScreen initialFrom={swapToken} onConnectWallet={() => setShowConnect(true)}/>;
      case 'portfolio': return <PortfolioScreen onSend={(t) => { setSendToken(t); requireWallet(() => setShowSend(true))(); }} onSwap={(t) => { setSwapToken(t); setScreen('swap'); }}/>;
      case 'nft':       return <NFTScreen/>;
      case 'stake':     return <StakeScreen/>;
    }
  })();

  const overlayContent = protocolId
    ? <ProtocolDetailScreen id={protocolId} onBack={() => setProtocolId(null)}/>
    : protocolCategory
    ? <ProtocolCategoryScreen category={protocolCategory} onBack={() => setProtocolCategory(null)} onProtocol={id => setProtocolId(id)}/>
    : overlay === 'docs'
    ? <DocsScreen onBack={() => setOverlay(null)}/>
    : overlay === 'products'
    ? <ProductsScreen onBack={() => setOverlay(null)} onCategory={c => setProtocolCategory(c as ProtocolCategory)}/>
    : null;

  const meta = PAGE_META[screen];

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: btb.bg, display: 'flex' }}>
      <Sidebar
        tab={screen}
        setTab={goto}
        address={effectiveAddress}
        isReadOnly={isReadOnly}
        onDisconnect={handleLeave}
        onDocs={() => setOverlay('docs')}
        onProducts={() => setOverlay('products')}
        onConnect={() => setShowConnect(true)}
      />
      <div style={{ flex: 1, minWidth: 0, padding: '32px 40px 60px', overflowY: 'auto' }}>
        {overlayContent ?? (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ color: btb.text, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{meta.title}</div>
              <div style={{ color: btb.textMuted, fontSize: 14, marginTop: 4 }}>{meta.subtitle}</div>
            </div>
            {content}
          </>
        )}
      </div>
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
