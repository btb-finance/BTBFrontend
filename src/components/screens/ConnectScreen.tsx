'use client';
import { useConfig, useConnect, useConnectors, useConnection, useEnsAddress, useSwitchChain } from 'wagmi';
import type { Connector } from 'wagmi';
import { normalize } from 'viem/ens';
import { useEffect, useMemo, useState } from 'react';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import { Screen } from '../Screen';
import { Portal } from '../Portal';
import { btb } from '../design-tokens';
import { useSidebar } from '../../lib/SidebarContext';

function isValidAddress(v: string) { return /^0x[a-fA-F0-9]{40}$/.test(v.trim()); }
function ensName(v: string): string | undefined {
  const t = v.trim().toLowerCase();
  if (!/^[^\s.]+(\.[^\s.]+)*\.[a-z]{2,}$/.test(t) || t.startsWith('0x')) return undefined;
  try { return normalize(t); } catch { return undefined; }
}

type Row = { key: string; connector: Connector; name: string; sub: string; icon?: string; glyph: string; bg: string };

// Connectors we configure ourselves, by wagmi id. Everything else of type
// 'injected' was announced by an installed extension through EIP-6963 and
// carries its own name and icon.
const SDK_IDS = new Set(['metaMaskSDK', 'coinbaseWalletSDK', 'walletConnect', 'injected', 'safe']);

function hasLegacyInjected() {
  return typeof window !== 'undefined' && Boolean((window as { ethereum?: unknown }).ethereum);
}

/** Short, human text for the errors people actually hit while connecting. */
function friendlyError(e: Error): string {
  const m = `${e.name} ${e.message}`;
  if (/rejected|denied|cancel/i.test(m)) return 'Request cancelled in your wallet.';
  if (/already pending|-32002/i.test(m)) return 'Your wallet already has a request open. Check the wallet window.';
  if (/provider not found|ProviderNotFound/i.test(m)) return 'That wallet is not installed in this browser.';
  if (/already connected/i.test(m)) return 'Already connected.';
  return 'Could not connect. Try again or pick another wallet.';
}

export function ConnectScreen({ onConnect, onImport, onClose }: { onConnect: () => void; onImport?: (address: string) => void; onClose?: () => void }) {
  const { width: sidebarWidth } = useSidebar();
  const config = useConfig();
  const { connectAsync, isPending, error, reset } = useConnect();
  const { switchChain } = useSwitchChain();
  const connectors = useConnectors();
  const { isConnected } = useConnection();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [recentId, setRecentId] = useState<string | null>(null);
  const [importAddr, setImportAddr] = useState('');

  const name = ensName(importAddr);
  const ens = useEnsAddress({ name, chainId: 1, query: { enabled: Boolean(name) } });
  const resolved = isValidAddress(importAddr) ? importAddr.trim() : ens.data ?? undefined;

  useEffect(() => {
    if (isConnected) onConnect();
  }, [isConnected, onConnect]);

  useEffect(() => {
    Promise.resolve(config.storage?.getItem('recentConnectorId'))
      .then(v => setRecentId(typeof v === 'string' ? v : null))
      .catch(() => {});
  }, [config]);

  const rows = useMemo<Row[]>(() => {
    const byId = (id: string) => connectors.find(c => c.id === id);
    const installed: Row[] = connectors
      .filter(c => c.type === 'injected' && !SDK_IDS.has(c.id))
      .map(c => ({ key: c.id, connector: c, name: c.name, sub: 'Installed', icon: c.icon, glyph: c.name[0] ?? 'W', bg: '#333' }));
    const out: Row[] = [...installed];
    const mm = byId('metaMaskSDK');
    if (mm) out.push({ key: mm.id, connector: mm, name: 'MetaMask', sub: 'Extension or mobile app', glyph: 'M', bg: '#F6851B' });
    const cb = byId('coinbaseWalletSDK');
    if (cb) out.push({ key: cb.id, connector: cb, name: 'Coinbase Wallet', sub: 'Extension, app or passkey', glyph: 'C', bg: '#1652F0' });
    const wc = byId('walletConnect');
    if (wc) out.push({ key: wc.id, connector: wc, name: 'WalletConnect', sub: 'Scan a QR code with any wallet app', glyph: 'W', bg: '#3B99FC' });
    // Older extensions that do not announce themselves still expose window.ethereum.
    const inj = byId('injected');
    if (inj && installed.length === 0 && hasLegacyInjected()) {
      out.unshift({ key: inj.id, connector: inj, name: 'Browser Wallet', sub: 'Detected in this browser', glyph: 'B', bg: '#333' });
    }
    // The wallet used last time goes first.
    const i = out.findIndex(r => r.key === recentId);
    if (i > 0) out.unshift(...out.splice(i, 1));
    return out;
  }, [connectors, recentId]);

  async function pick(r: Row) {
    if (isPending) return;
    reset();
    setPendingKey(r.key);
    try {
      const res = await connectAsync({ connector: r.connector });
      // Ask for mainnet, but never let a declined switch undo the connection.
      // Every transaction switches to its own chain first anyway (txRunner).
      if (res.chainId !== 1) switchChain({ chainId: 1 }, { onError: () => {} });
    } catch {
      // Shown through `error` below.
    } finally {
      setPendingKey(null);
    }
  }

  function submitImport() {
    if (!resolved || !onImport) return;
    onImport(resolved.toLowerCase());
  }

  return (
    <Portal>
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto',
    }}>
    <div role="dialog" aria-modal="true" aria-label="Connect a wallet" onClick={e => e.stopPropagation()} style={{
      width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
      background: btb.bg, borderRadius: 28, border: btb.border, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      position: 'relative',
    }}>
      {onClose && (
        <button type="button" aria-label="Close" onClick={onClose} style={{
          position: 'absolute', top: 25, right: 18, width: 34, height: 34, borderRadius: 999, zIndex: 1,
          background: 'rgba(var(--fg-rgb), 0.08)', border: btb.borderSoft, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Icon name="close" size={15} color={btb.textMuted}/>
        </button>
      )}
    <Screen gap={18} style={{ padding: '22px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: onClose ? 40 : 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/btblogo.jpg" alt="" width={40} height={40}
          style={{ width: 40, height: 40, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }}/>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>Connect a wallet</div>
          <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 2 }}>to BTB Finance</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(r => {
          const busy = pendingKey === r.key;
          return (
            <button key={r.key} type="button" onClick={() => pick(r)} disabled={isPending && !busy}
              style={{ all: 'unset', display: 'block', cursor: isPending ? 'default' : 'pointer', borderRadius: 20 }}>
              <Glass padding={14} radius={20}
                style={{ opacity: isPending && !busy ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {r.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.icon} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }}/>
                  ) : (
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: r.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 22, fontWeight: 700,
                      boxShadow: 'inset 0 1px 0 rgba(var(--fg-rgb), 0.25)',
                    }}>{r.glyph}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: btb.text, fontSize: 16, fontWeight: 600 }}>{r.name}</span>
                      {r.key === recentId && (
                        <span style={{ color: btb.green, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>Last used</span>
                      )}
                    </div>
                    <div style={{ color: btb.textMuted, fontSize: 12 }}>{busy ? 'Confirm in your wallet' : r.sub}</div>
                  </div>
                  {busy
                    ? <Spinner size={18} color="var(--btb-text)" track="rgba(var(--fg-rgb), 0.3)" />
                    : <Icon name="arrow" size={18} color="rgba(var(--fg-rgb), 0.5)"/>
                  }
                </div>
              </Glass>
            </button>
          );
        })}
      </div>

      {error && !isPending && (
        <div role="alert" style={{
          background: 'rgba(var(--fg-rgb), 0.1)', border: '1px solid rgba(var(--fg-rgb), 0.18)',
          borderRadius: 14, padding: '10px 14px',
          color: btb.pink, fontSize: 13, textAlign: 'center',
        }}>
          {friendlyError(error)}
        </div>
      )}

      {/* Read-only viewer: paste any address or ENS name to inspect its portfolio without signing in. */}
      {onImport && (
        <Glass padding={14} radius={18}>
          <div style={{ color: btb.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
            Or view any wallet
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={importAddr}
              onChange={(e) => setImportAddr(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && resolved) submitImport(); }}
              placeholder="0x address or name.eth"
              aria-label="Wallet address or ENS name"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              style={{
                flex: 1, minWidth: 0,
                background: 'rgba(var(--fg-rgb), 0.06)', border: '1px solid rgba(var(--fg-rgb), 0.12)',
                borderRadius: 12, padding: '10px 12px',
                color: btb.text, fontSize: 13, fontFamily: 'monospace', letterSpacing: 0.2,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={submitImport}
              disabled={!resolved}
              style={{
                padding: '0 14px', borderRadius: 12, border: 'none', cursor: resolved ? 'pointer' : 'default',
                background: resolved ? 'rgba(var(--fg-rgb), 0.18)' : 'rgba(var(--fg-rgb), 0.06)',
                color: resolved ? btb.text : btb.textDim,
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              }}
            >View</button>
          </div>
          <div style={{ color: btb.textDim, fontSize: 11, marginTop: 8, lineHeight: 1.4 }}>
            {name && ens.isLoading ? 'Looking up name...'
              : name && ens.isFetched && !ens.data ? 'No address found for that name.'
              : name && ens.data ? `${ens.data.slice(0, 6)}...${ens.data.slice(-4)}`
              : 'Read-only. See balances, prices and history. Sending, swapping and minting need a connected wallet.'}
          </div>
        </Glass>
      )}

      <div style={{ textAlign: 'center', color: btb.textDim, fontSize: 12, lineHeight: 1.5 }}>
        By continuing you agree to BTB&apos;s<br/>
        <span style={{ color: btb.textMuted, textDecoration: 'underline' }}>Terms</span>
        {' '}and{' '}
        <span style={{ color: btb.textMuted, textDecoration: 'underline' }}>Privacy Policy</span>
      </div>
    </Screen>
    </div>
    </div>
    </Portal>
  );
}
