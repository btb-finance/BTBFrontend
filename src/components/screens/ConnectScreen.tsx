'use client';
import { useConnect, useAccount } from 'wagmi';
import { useEffect, useState } from 'react';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { btb } from '../design-tokens';

function isValidAddress(v: string) { return /^0x[a-fA-F0-9]{40}$/.test(v.trim()); }

type WalletDef = {
  id: string;
  name: string;
  sub: string;
  glyph: string;
  bg: string;
  connectorId: string;
};

// `connectorId` matches the `id` exposed by each @wagmi/connectors connector.
const WALLETS: WalletDef[] = [
  { id: 'metamask',      name: 'MetaMask',        sub: 'Mobile + extension', glyph: '🦊', bg: '#F6851B',                                            connectorId: 'metaMaskSDK' },
  { id: 'coinbase',      name: 'Coinbase Wallet', sub: 'Easy onboarding',    glyph: 'C',  bg: '#1652F0',                                            connectorId: 'coinbaseWalletSDK' },
  { id: 'walletconnect', name: 'WalletConnect',   sub: 'Scan with any app',  glyph: '∞',  bg: '#3B99FC',                                            connectorId: 'walletConnect' },
  { id: 'rainbow',       name: 'Rainbow',         sub: 'Mobile-first',       glyph: '🌈', bg: 'linear-gradient(135deg,#FF6B6B,#94A3B8)',            connectorId: 'walletConnect' },
  { id: 'injected',      name: 'Browser Wallet',  sub: 'Brave, Rabby, OKX…', glyph: '◆',  bg: '#333',                                              connectorId: 'injected' },
];

export function ConnectScreen({ onConnect, onImport }: { onConnect: () => void; onImport?: (address: string) => void }) {
  const { connect, connectors, isPending, error } = useConnect();
  const { isConnected } = useAccount();
  const [importAddr, setImportAddr] = useState('');
  const importValid = isValidAddress(importAddr);

  useEffect(() => {
    if (isConnected) onConnect();
  }, [isConnected, onConnect]);

  function submitImport() {
    if (!importValid || !onImport) return;
    onImport(importAddr.trim().toLowerCase());
  }

  function handleWallet(w: WalletDef) {
    const connector = connectors.find(c =>
      c.id === w.connectorId ||
      c.name.toLowerCase().includes(w.id) ||
      c.id.toLowerCase().includes(w.connectorId.toLowerCase())
    ) ?? connectors[0];
    if (connector) connect({ connector });
  }

  return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 20px 40px', display: 'flex', flexDirection: 'column', height: '100%', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, marginTop: 24 }}>
        <div style={{
          width: 92, height: 92, borderRadius: 28,
          background: 'linear-gradient(140deg,#FFFFFF 0%, #1E293B 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 16px 40px rgba(226,232,240,0.55), inset 0 2px 0 rgba(255,255,255,0.25)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4), transparent 50%)' }}/>
          <span style={{ color: '#fff', fontSize: 44, fontWeight: 900, letterSpacing: -2, position: 'relative' }}>B</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: btb.text, fontSize: 30, fontWeight: 800, letterSpacing: -0.8 }}>BTB Finance</div>
          <div style={{ color: btb.textMuted, fontSize: 15, marginTop: 6, lineHeight: 1.45, maxWidth: 280 }}>
            Swap, stake, and mint NFTs from one frosted wallet.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {WALLETS.map(w => (
          <Glass key={w.id} padding={14} radius={20} onClick={() => handleWallet(w)}
            style={{ opacity: isPending ? 0.7 : 1, transition: 'opacity 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: w.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 22, fontWeight: 700,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
              }}>{w.glyph}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: btb.text, fontSize: 16, fontWeight: 600 }}>{w.name}</div>
                <div style={{ color: btb.textMuted, fontSize: 12 }}>{w.sub}</div>
              </div>
              {isPending
                ? <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFFFFF', animation: 'spin 0.8s linear infinite' }}/>
                : <Icon name="arrow" size={18} color="rgba(255,255,255,0.5)"/>
              }
            </div>
          </Glass>
        ))}
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 14, padding: '10px 14px',
          color: btb.pink, fontSize: 13, textAlign: 'center',
        }}>
          {error.message.slice(0, 120)}
        </div>
      )}

      {/* Read-only viewer — paste any address to inspect its portfolio without signing in. */}
      {onImport && (
        <Glass padding={14} radius={18}>
          <div style={{ color: btb.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
            Or view any wallet
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={importAddr}
              onChange={(e) => setImportAddr(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && importValid) submitImport(); }}
              placeholder="0x… address or ENS-resolved"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              style={{
                flex: 1, minWidth: 0,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12, padding: '10px 12px',
                color: btb.text, fontSize: 13, fontFamily: 'monospace', letterSpacing: 0.2,
                outline: 'none',
              }}
            />
            <button
              onClick={submitImport}
              disabled={!importValid}
              style={{
                padding: '0 14px', borderRadius: 12, border: 'none', cursor: importValid ? 'pointer' : 'default',
                background: importValid ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
                color: importValid ? '#fff' : btb.textDim,
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              }}
            >View</button>
          </div>
          <div style={{ color: btb.textDim, fontSize: 11, marginTop: 8, lineHeight: 1.4 }}>
            Read-only — see balances, prices, and history. Sending, swapping, and minting need a connected wallet.
          </div>
        </Glass>
      )}

      <div style={{ marginTop: 'auto', textAlign: 'center', color: btb.textDim, fontSize: 12, lineHeight: 1.5 }}>
        By continuing you agree to BTB&apos;s<br/>
        <span style={{ color: btb.textMuted, textDecoration: 'underline' }}>Terms</span>
        {' '}and{' '}
        <span style={{ color: btb.textMuted, textDecoration: 'underline' }}>Privacy Policy</span>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
