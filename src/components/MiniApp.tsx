'use client';
import { useState, useEffect } from 'react';
import { useConnection, useDisconnect, useSwitchChain } from 'wagmi';
import { Background } from './Background';
import { TabBar, Tab } from './TabBar';
import { ConnectScreen } from './screens/ConnectScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SwapScreen } from './screens/SwapScreen';
import { PortfolioScreen } from './screens/PortfolioScreen';
import { NFTScreen } from './screens/NFTScreen';
import { StakeScreen } from './screens/StakeScreen';
import { ReceiveModal } from './ReceiveModal';
import { SendModal } from './SendModal';
import { DocsScreen } from './screens/DocsScreen';
import { ProductsScreen } from './screens/ProductsScreen';
import { ProtocolCategoryScreen, ProtocolDetailScreen, ProtocolCategory } from './screens/ProtocolScreen';
import { PaletteKey } from './design-tokens';
import { TokenStoreProvider, Token } from '../lib/TokenStore';
import { usePreloadBear } from '../lib/preloadBear';

function AppShell({ effectiveAddress, isReadOnly, onImportAddress, onLeave }: {
  effectiveAddress?: string;
  isReadOnly: boolean;
  onImportAddress: (addr: string) => void;
  onLeave: () => void;
}) {
  const [screen, setScreen]   = useState<Tab | 'connect'>(effectiveAddress ? 'home' : 'connect');
  const [overlay, setOverlay] = useState<'docs' | 'products' | null>(null);
  const [protocolCategory, setProtocolCategory] = useState<ProtocolCategory | null>(null);
  const [protocolId, setProtocolId] = useState<string | null>(null);
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend]       = useState(false);
  const [sendToken, setSendToken]     = useState<Token | undefined>();
  const [swapToken, setSwapToken]     = useState<Token | undefined>();
  const palette: PaletteKey = 'ember';

  // Warm the BearNFT/BearStaking reads while the user is anywhere in the app so
  // the NFT/Agent tab is instant when they open it.
  usePreloadBear(effectiveAddress);

  const goto = (t: Tab) => { if (t === 'swap') setSwapToken(undefined); setScreen(t); };

  const handleLeave = () => { onLeave(); setScreen('connect'); };

  const content = (() => {
    switch (screen) {
      case 'connect':   return <ConnectScreen
                          onConnect={() => setScreen('home')}
                          onImport={(a) => { onImportAddress(a); setScreen('home'); }}
                        />;
      case 'home':      return <HomeScreen goto={goto} address={effectiveAddress}
                          onDisconnect={handleLeave}
                          onReceive={() => setShowReceive(true)} onSend={() => setShowSend(true)}
                          onDocs={() => setOverlay('docs')} onProducts={() => setOverlay('products')}/>;
      case 'swap':      return <SwapScreen initialFrom={swapToken}/>;
      case 'portfolio': return <PortfolioScreen onSend={(t) => { setSendToken(t); setShowSend(true); }} onSwap={(t) => { setSwapToken(t); setScreen('swap' as any); }}/>;
      case 'nft':       return <NFTScreen/>;
      case 'stake':     return <StakeScreen/>;
    }
  })();

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#0A0A0F', position: 'relative', overflow: 'hidden' }}>
      <Background palette={palette}/>
      {/* Phone-frame column — centered on desktop, full-width on mobile. */}
      <div style={{
        position: 'relative', zIndex: 1, minHeight: '100vh',
        maxWidth: 480, margin: '0 auto', overflowY: 'auto',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px rgba(0,0,0,0.45)',
      }}>
        {/* Read-only banner — sits above content so every screen surfaces it. */}
        {isReadOnly && screen !== 'connect' && (
          <div style={{
            padding: 'env(safe-area-inset-top, 10px) 16px 6px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            background: 'rgba(255,179,107,0.08)', borderBottom: '1px solid rgba(255,179,107,0.18)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: 999, color: '#FFB36B',
                background: 'rgba(255,179,107,0.18)', border: '1px solid rgba(255,179,107,0.35)',
                flexShrink: 0,
              }}>Read-only</span>
              <span style={{ color: 'rgba(255,179,107,0.85)', fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {effectiveAddress?.slice(0, 8)}…{effectiveAddress?.slice(-6)}
              </span>
            </div>
            <span onClick={handleLeave} style={{ color: '#FFB36B', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Exit</span>
          </div>
        )}
        {protocolId            ? <ProtocolDetailScreen id={protocolId} onBack={() => setProtocolId(null)}/>
         : protocolCategory     ? <ProtocolCategoryScreen category={protocolCategory} onBack={() => setProtocolCategory(null)} onProtocol={id => setProtocolId(id)}/>
         : overlay === 'docs'   ? <DocsScreen onBack={() => setOverlay(null)}/>
         : overlay === 'products' ? <ProductsScreen onBack={() => setOverlay(null)} onCategory={c => setProtocolCategory(c as ProtocolCategory)}/>
         : content}
      </div>
      {screen !== 'connect' && !overlay && <TabBar tab={screen as Tab} setTab={setScreen as (t: Tab) => void}/>}
      {showReceive && <ReceiveModal address={effectiveAddress ?? '0x0000000000000000000000000000000000000000'} onClose={() => setShowReceive(false)}/>}
      {showSend    && <SendModal fromAddress={effectiveAddress ?? '0x0000000000000000000000000000000000000000'} onClose={() => { setShowSend(false); setSendToken(undefined); }} initialToken={sendToken}/>}
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
    <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.18)', borderTopColor: '#FFFFFF' }} className="spin"/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 0.8s linear infinite}`}</style>
    </div>
  );

  return (
    <TokenStoreProvider walletAddress={effectiveAddress}>
      <AppShell
        effectiveAddress={effectiveAddress}
        isReadOnly={isReadOnly}
        onImportAddress={setReadOnlyAddress}
        onLeave={handleLeave}
      />
    </TokenStoreProvider>
  );
}
