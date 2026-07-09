'use client';
import { useState } from 'react';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { Screen } from '../Screen';
import { Button } from '../Button';
import { btb } from '../design-tokens';
import { CONTRACTS } from '../../lib/wagmi';

const BTB_ADDRESS = CONTRACTS.BTB;
const shortAddr = `${BTB_ADDRESS.slice(0, 6)}…${BTB_ADDRESS.slice(-4)}`;

const HIGHLIGHTS = [
  { icon: 'chart',  color: '#52E3A4', bg: 'rgba(82,227,164,0.12)',  title: 'Powers the protocol', desc: 'BTB is the core asset behind swaps, LP simulations, and rewards across the app.' },
  { icon: 'lock',   color: '#FFB36B', bg: 'rgba(255,179,107,0.15)', title: 'Stake & earn',        desc: 'Lock BTB to earn protocol yield and unlock Bear NFT staking multipliers.' },
  { icon: 'shield', color: '#FFFFFF', bg: 'rgba(255,255,255,0.08)', title: 'On Ethereum',         desc: 'An ERC-20 deployed on Ethereum mainnet — non-custodial and fully on-chain.' },
];

export function TokenScreen({ onSwap }: { onSwap: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard?.writeText(BTB_ADDRESS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };

  return (
    <Screen gap={18} style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* hero */}
      <Glass padding={28} radius={28} strong style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 0%, rgba(255,255,255,0.18), transparent 55%), radial-gradient(circle at 80% 100%, rgba(82,227,164,0.16), transparent 55%)',
          pointerEvents: 'none',
        }}/>
        <div style={{ position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/btblogo.jpg"
            alt="BTB"
            width={76}
            height={76}
            style={{
              width: 76, height: 76, borderRadius: 24, margin: '0 auto 18px', display: 'block',
              objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 12px 32px rgba(82,227,164,0.22), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          />
          <div style={{ color: btb.text, fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>
            BTB Token
          </div>
          <div style={{ color: btb.textMuted, fontSize: 14, lineHeight: 1.55, maxWidth: 360, margin: '0 auto' }}>
            The token that powers the BTB Finance ecosystem — trade it, stake it, and use it across every tool in the app.
          </div>

          {/* contract address */}
          <div
            onClick={copyAddress}
            title="Copy contract address"
            style={{
              marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              padding: '8px 14px', borderRadius: 12, background: btb.surfaceSoft, border: btb.borderSoft,
            }}
          >
            <span style={{ color: btb.textMuted, fontSize: 12.5, fontWeight: 600, fontFamily: 'monospace' }}>{shortAddr}</span>
            <Icon name={copied ? 'check' : 'plus'} size={13} color={copied ? btb.green : btb.textMuted}/>
            <span style={{ color: copied ? btb.green : btb.textDim, fontSize: 11, fontWeight: 700 }}>
              {copied ? 'Copied' : 'Copy'}
            </span>
          </div>
        </div>
      </Glass>

      {/* buy / swap cta */}
      <Button variant="success" size="lg" icon="swap" onClick={onSwap}>
        Swap for BTB
      </Button>

      {/* highlights */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {HIGHLIGHTS.map(h => (
          <Glass key={h.title} padding={14} radius={18}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, background: h.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={h.icon} size={20} color={h.color}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.text, fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{h.title}</div>
                <div style={{ color: btb.textMuted, fontSize: 12.5, lineHeight: 1.5 }}>{h.desc}</div>
              </div>
            </div>
          </Glass>
        ))}
      </div>

      {/* external links */}
      <Glass padding={18} radius={20} soft style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', border: btb.borderSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name="launch" size={18} color={btb.textMuted}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700 }}>Explore on-chain</div>
          <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2 }}>
            View on <a href={`https://etherscan.io/token/${BTB_ADDRESS}`} target="_blank" rel="noreferrer" style={{ color: btb.text, textDecoration: 'underline' }}>Etherscan</a> or <a href={`https://dexscreener.com/ethereum/${BTB_ADDRESS}`} target="_blank" rel="noreferrer" style={{ color: btb.text, textDecoration: 'underline' }}>Dexscreener</a>.
          </div>
        </div>
      </Glass>
    </Screen>
  );
}
