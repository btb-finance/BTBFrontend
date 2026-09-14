'use client';
import { useEffect, useState } from 'react';
import { useConnection, useSignMessage } from 'wagmi';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Portal } from './Portal';
import { Button } from './Button';
import { Icon } from './Icon';
import { btb } from './design-tokens';
import { linkMessage, shortAddr } from '../lib/profile';

/**
 * Link a second wallet to the connected wallet's profile.
 *
 * Two signatures, no transaction: the connected wallet signs first, then the
 * user switches accounts (or connects another wallet) and the new wallet
 * signs. Both go to a Convex action that verifies them before writing.
 */
export function LinkWalletSheet({ onClose, onLinked }: { onClose: () => void; onLinked?: (address: string) => void }) {
  const { address } = useConnection();
  const { signMessageAsync } = useSignMessage();
  const link = useAction(api.profilesActions.link);
  const [anchor, setAnchor] = useState<{ address: string; signature: string; issuedAt: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Step 2 fires by itself the moment a different account shows up.
  const pendingOther = anchor && address && address.toLowerCase() !== anchor.address.toLowerCase() ? address : null;

  async function signAnchor() {
    if (!address) return;
    setBusy(true); setErr(null);
    try {
      const issuedAt = Date.now();
      // The other wallet is unknown yet, so the anchor signs over a placeholder
      // the server never accepts; it is re-signed once the second wallet is known.
      setAnchor({ address, signature: '', issuedAt });
    } catch (e) {
      setErr((e as Error)?.message ?? 'Failed');
    } finally { setBusy(false); }
  }

  async function finish() {
    if (!anchor || !pendingOther) return;
    setBusy(true); setErr(null);
    try {
      // New wallet signs naming the anchor.
      const otherIssuedAt = Date.now();
      const otherSig = await signMessageAsync({ message: linkMessage(pendingOther, anchor.address, otherIssuedAt) });
      setDone(null);
      setPendingAnchorSign({ other: pendingOther, otherSig, otherIssuedAt });
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Signature rejected');
    } finally { setBusy(false); }
  }

  // After the second wallet signed, the user switches back to the anchor and it signs naming the second wallet.
  const [pendingAnchorSign, setPendingAnchorSign] = useState<{ other: string; otherSig: string; otherIssuedAt: number } | null>(null);
  const backOnAnchor = pendingAnchorSign && anchor && address && address.toLowerCase() === anchor.address.toLowerCase();

  async function signAnchorFinal() {
    if (!anchor || !pendingAnchorSign) return;
    setBusy(true); setErr(null);
    try {
      const issuedAt = Date.now();
      const sig = await signMessageAsync({ message: linkMessage(anchor.address, pendingAnchorSign.other, issuedAt) });
      await link({
        anchor: anchor.address, anchorSignature: sig, anchorIssuedAt: issuedAt,
        address: pendingAnchorSign.other, addressSignature: pendingAnchorSign.otherSig, addressIssuedAt: pendingAnchorSign.otherIssuedAt,
      });
      setDone(pendingAnchorSign.other);
      onLinked?.(pendingAnchorSign.other);
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Linking failed');
    } finally { setBusy(false); }
  }

  useEffect(() => { if (!address) setErr('Connect a wallet first'); }, [address]);

  const step = done ? 4 : pendingAnchorSign ? 3 : anchor ? 2 : 1;

  return (
    <Portal>
      <div onClick={busy ? undefined : onClose} style={{ position: 'fixed', inset: 0, zIndex: 420, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: btb.bg, border: btb.border, borderRadius: 28, padding: '20px 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>Link another wallet</div>
            {!busy && <div onClick={onClose} style={{ cursor: 'pointer' }}><Icon name="close" size={16} color={btb.textMuted}/></div>}
          </div>
          <div style={{ color: btb.textMuted, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
            Sign with both wallets once. No transaction, no gas. Afterwards, connecting with either wallet shows every wallet in your profile.
          </div>

          <Step n={1} active={step === 1} done={step > 1} title={`Start from ${anchor ? shortAddr(anchor.address) : address ? shortAddr(address) : 'your wallet'}`}>
            This wallet becomes the profile anchor.
          </Step>
          <Step n={2} active={step === 2} done={step > 2} title="Switch to the wallet you want to add">
            {step === 2 && !pendingOther && <span>In your wallet, switch to the other account (or connect a different wallet). This step continues on its own.</span>}
            {step === 2 && pendingOther && <span>Detected <b style={{ color: btb.text }}>{shortAddr(pendingOther)}</b>. Sign to prove you control it.</span>}
          </Step>
          <Step n={3} active={step === 3} done={step > 3} title={`Switch back to ${anchor ? shortAddr(anchor.address) : 'the first wallet'} and confirm`}>
            {step === 3 && !backOnAnchor && <span>Switch back to the first account, then sign once more.</span>}
            {step === 3 && backOnAnchor && <span>Ready. One signature confirms the link.</span>}
          </Step>
          {done && (
            <div style={{ color: btb.green, fontSize: 13, fontWeight: 700, marginTop: 12 }}>Linked {shortAddr(done)}. Both wallets now open the same profile.</div>
          )}

          {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 12 }}>{err}</div>}

          <div style={{ marginTop: 16 }}>
            {step === 1 && <Button variant="success" size="md" onClick={signAnchor} disabled={!address || busy} loading={busy}>Start</Button>}
            {step === 2 && pendingOther && <Button variant="success" size="md" onClick={finish} disabled={busy} loading={busy}>Sign with {shortAddr(pendingOther)}</Button>}
            {step === 2 && !pendingOther && <Button variant="ghost" size="md" disabled>Waiting for the other account…</Button>}
            {step === 3 && backOnAnchor && <Button variant="success" size="md" onClick={signAnchorFinal} disabled={busy} loading={busy}>Confirm link</Button>}
            {step === 3 && !backOnAnchor && <Button variant="ghost" size="md" disabled>Waiting for {anchor ? shortAddr(anchor.address) : 'the first wallet'}…</Button>}
            {step === 4 && <Button variant="success" size="md" onClick={onClose}>Done</Button>}
          </div>
        </div>
      </div>
    </Portal>
  );
}

function Step({ n, title, active, done, children }: { n: number; title: string; active: boolean; done: boolean; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, background: active ? 'rgba(var(--green-rgb), 0.06)' : btb.surfaceSoft, border: `1px solid ${active ? 'rgba(var(--green-rgb), 0.3)' : 'rgba(var(--fg-rgb), 0.07)'}`, borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}>
      <span style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, background: done ? btb.green : 'rgba(var(--green-rgb), 0.18)', color: done ? '#0A0A0F' : btb.green, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700 }}>{title}</div>
        {children && <div style={{ color: btb.textMuted, fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>{children}</div>}
      </div>
    </div>
  );
}
