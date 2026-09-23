'use client';
import { useState } from 'react';
import { useConnection, useSignMessage } from 'wagmi';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { btb } from './design-tokens';
import { LinkWalletSheet } from './LinkWalletSheet';
import { useProfileWallets, shortAddr, linkMessage } from '../lib/profile';

/**
 * Every wallet in the connected wallet's profile, the one being viewed
 * marked, plus the entry point to link another. Used inside the user menu
 * and at the top of Portfolio.
 */
export function WalletSwitcher({ viewAddress, onViewAddress, compact = false, onPick }: {
  viewAddress?: string;
  onViewAddress: (addr: string | undefined) => void;
  compact?: boolean;
  onPick?: () => void;
}) {
  const { address: connected } = useConnection();
  const { wallets } = useProfileWallets(connected);
  const [linking, setLinking] = useState(false);
  const { signMessageAsync } = useSignMessage();
  const unlink = useAction(api.profilesActions.unlink);
  const [removing, setRemoving] = useState<string | null>(null);
  // Profiles that imported this wallet view-only. It only sees their wallets once it signs to join.
  const invites = useQuery(api.profiles.invitesFor, connected ? { address: connected } : 'skip') ?? [];
  const joinProfile = useAction(api.profilesActions.joinProfile);
  const [joining, setJoining] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  async function join(profileId: string) {
    if (!connected) return;
    setJoining(profileId); setJoinError(null);
    try {
      const issuedAt = Date.now();
      const signature = await signMessageAsync({ message: linkMessage(connected, profileId, issuedAt) });
      await joinProfile({ address: connected, profileId, signature, issuedAt });
    } catch (e) {
      const m = (e as Error)?.message ?? '';
      setJoinError(/rejected|denied/i.test(m) ? 'Signature cancelled.' : 'Could not join. Try again.');
    } finally { setJoining(null); }
  }
  async function remove(addr: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!connected) return;
    setRemoving(addr);
    try {
      const issuedAt = Date.now();
      const signature = await signMessageAsync({ message: linkMessage(connected, addr, issuedAt) });
      await unlink({ signer: connected, signature, issuedAt, address: addr });
      if ((viewAddress ?? '').toLowerCase() === addr) onViewAddress(undefined);
    } catch {} finally { setRemoving(null); }
  }
  if (!connected) return null;
  const current = (viewAddress ?? connected).toLowerCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {!compact && <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, padding: '4px 10px 6px' }}>Your wallets</div>}
      {invites.map(inv => (
        <div key={inv.profileId} style={{ margin: '2px 4px 6px', padding: '10px 10px', borderRadius: 12, border: '1px solid rgba(var(--green-rgb), 0.3)', background: 'rgba(var(--green-rgb), 0.07)' }}>
          <div style={{ color: btb.text, fontSize: 12, fontWeight: 700, lineHeight: 1.45 }}>
            This wallet{inv.label ? ` ("${inv.label}")` : ''} was added to the profile of {shortAddr(inv.profileId)}.
          </div>
          <div style={{ color: btb.textMuted, fontSize: 11.5, marginTop: 3, lineHeight: 1.45 }}>Join it to see all those wallets here. One signature, no transaction.</div>
          <button type="button" onClick={() => join(inv.profileId)} disabled={joining === inv.profileId} style={{ marginTop: 8, height: 30, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(var(--green-rgb), 0.45)', background: 'rgba(var(--green-rgb), 0.16)', color: btb.green, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            {joining === inv.profileId ? 'Sign in wallet' : 'Join profile'}
          </button>
          {joinError && <div style={{ color: btb.amber, fontSize: 11, marginTop: 6 }}>{joinError}</div>}
        </div>
      ))}
      {wallets.map(w => {
        const active = w.address === current;
        const isConnected = w.address === connected.toLowerCase();
        return (
          <div key={w.address} onClick={() => { onViewAddress(isConnected ? undefined : w.address); onPick?.(); }} style={{
            display: 'flex', alignItems: 'center', gap: 10, height: 38, padding: '0 10px', borderRadius: 10, cursor: 'pointer',
            background: active ? btb.surfaceStrong : 'transparent',
          }}>
            <Dot address={w.address}/>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: active ? btb.text : btb.textMuted, fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: w.label ? 'inherit' : 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {w.label ?? shortAddr(w.address)}
              </div>
              {w.label && <div style={{ color: btb.textDim, fontSize: 10.5, fontFamily: 'monospace' }}>{shortAddr(w.address)}</div>}
            </div>
            <span style={{ color: btb.textDim, fontSize: 10, fontWeight: 700 }}>{isConnected ? 'connected' : w.watched ? 'imported' : active ? 'viewing' : ''}</span>
            {!isConnected && (
              <span onClick={(e) => remove(w.address, e)} title="Remove from profile" style={{ color: btb.textDim, fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: removing === w.address ? 0.4 : 1 }}>×</span>
            )}
          </div>
        );
      })}
      <div onClick={() => setLinking(true)} style={{ display: 'flex', alignItems: 'center', height: 36, padding: '0 10px', borderRadius: 10, cursor: 'pointer', color: btb.green, fontSize: 12.5, fontWeight: 700 }}>
        Add a wallet
      </div>
      {linking && <LinkWalletSheet onClose={() => setLinking(false)}/>}
    </div>
  );
}

function Dot({ address }: { address: string }) {
  const h1 = parseInt(address.slice(2, 8), 16) % 360;
  return <span style={{ width: 10, height: 10, borderRadius: 999, flexShrink: 0, background: `linear-gradient(135deg, hsl(${h1} 70% 55%), hsl(${(h1 + 60) % 360} 70% 45%))` }}/>;
}
