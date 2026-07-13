'use client';
import { useState } from 'react';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { Screen } from '../Screen';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { btb } from '../design-tokens';
import { CONTRACTS } from '../../lib/wagmi';

const BTB_ADDRESS = CONTRACTS.BTB;
const shortAddr = `${BTB_ADDRESS.slice(0, 6)}…${BTB_ADDRESS.slice(-4)}`;

// Why stake BTB — the tokenomics story: real revenue, zero inflation.
const WHY_STAKE = [
  {
    icon: 'bank', color: '#52E3A4', bg: 'rgba(82,227,164,0.12)',
    title: 'Earn real protocol revenue',
    desc: 'Stake BTB and receive a share of what the protocol actually earns: fees from swaps, LP tools, and NFT mints. Just stake and collect. No lockup gymnastics, no extra steps.',
  },
  {
    icon: 'fire', color: '#FFB36B', bg: 'rgba(255,179,107,0.15)',
    title: 'Zero inflation',
    desc: 'Staking rewards are paid from revenue, never minted. The BTB supply does not inflate to pay you, so your stake is never diluted by emissions.',
  },
  {
    icon: 'shield', color: '#FFFFFF', bg: 'rgba(255,255,255,0.08)',
    title: 'No farm and dump',
    desc: 'Rewards come from real income instead of new tokens. There is no stream of freshly printed BTB hitting the market, so earning never creates sell pressure on the token you hold.',
  },
];

// BTB Pro — the product perks stakers unlock.
const PRO_PERKS = [
  {
    icon: 'bolt', color: '#38BDF8', bg: 'rgba(56,189,248,0.15)',
    title: 'A faster app, everywhere',
    desc: 'Your address, balances, and positions are kept warm on our cloud servers and continuously updated. The app opens already in sync instead of loading everything from scratch.',
  },
  {
    icon: 'refresh', color: '#52E3A4', bg: 'rgba(82,227,164,0.12)',
    title: 'Always up to date',
    desc: 'Prices, LP positions, and Earn balances refresh on the server around the clock, so what you see is current the moment you open the app on any device.',
  },
  {
    icon: 'shield', color: '#A78BFA', bg: 'rgba(167,139,250,0.15)',
    title: 'Risk management',
    desc: 'Pro watches your portfolio for risk. Low liquidity tokens, LPs that drift out of range, and sketchy approvals get flagged before they become a problem.',
  },
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
              width: 76, height: 76, borderRadius: 24, margin: '0 auto 14px', display: 'block',
              objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 12px 32px rgba(82,227,164,0.22), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          />
          <Badge color="#52E3A4" bg="rgba(82,227,164,0.14)" border="1px solid rgba(82,227,164,0.3)" style={{ letterSpacing: 0.6, marginBottom: 12 }}>
            REAL YIELD · ETHEREUM
          </Badge>
          <div style={{ color: btb.text, fontSize: 28, fontWeight: 800, letterSpacing: -0.7, lineHeight: 1.15, marginBottom: 10 }}>
            Stake BTB.<br/>Earn what the protocol earns.
          </div>
          <div style={{ color: btb.textMuted, fontSize: 14, lineHeight: 1.55, maxWidth: 380, margin: '0 auto' }}>
            Every fee the protocol collects flows back to stakers. Your share is paid
            from real revenue, not printed tokens.
          </div>

          {/* the three numbers that matter */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            {[
              { big: '100%', small: 'real revenue' },
              { big: '0%', small: 'inflation' },
              { big: '0', small: 'emissions' },
            ].map(s => (
              <div key={s.small} style={{
                padding: '10px 16px', borderRadius: 14, minWidth: 92,
                background: 'rgba(255,255,255,0.06)', border: btb.borderSoft,
              }}>
                <div style={{ color: btb.green, fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>{s.big}</div>
                <div style={{ color: btb.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.small}</div>
              </div>
            ))}
          </div>

          {/* contract address */}
          <div
            onClick={copyAddress}
            title="Copy contract address"
            style={{
              marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              padding: '8px 14px', borderRadius: 999, background: btb.surfaceSoft, border: btb.borderSoft,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: 999, background: btb.green, boxShadow: '0 0 8px rgba(82,227,164,0.8)', flexShrink: 0 }}/>
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

      {/* why stake */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 0' }}>
          <span style={{ color: btb.text, fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>Why stake BTB</span>
          <Badge color="#FFB36B" bg="rgba(255,179,107,0.15)" border="1px solid rgba(255,179,107,0.35)" style={{ gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFB36B', boxShadow: '0 0 8px #FFB36B' }}/>
            <span style={{ color: '#FFB36B', fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>STAKING COMING SOON</span>
          </Badge>
        </div>
        {WHY_STAKE.map(h => (
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

      {/* BTB Pro */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ padding: '4px 4px 0' }}>
          <span style={{ color: btb.text, fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>
            Staking unlocks <span style={{ color: '#38BDF8' }}>BTB Pro</span>
          </span>
          <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 3 }}>
            Beyond yield: stakers get the premium version of the app.
          </div>
        </div>
        {PRO_PERKS.map(h => (
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
        <div style={{ color: btb.textDim, fontSize: 11.5, lineHeight: 1.5, padding: '0 4px' }}>
          Always self custody: Pro only syncs public data (addresses, balances, positions) for speed.
          Your keys and funds never touch our servers.
        </div>
      </div>

      {/* launch notice */}
      <Glass padding={18} radius={20} soft style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(82,227,164,0.12)', border: '1px solid rgba(82,227,164,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name="star" size={18} color="#52E3A4"/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700 }}>Staking launches soon</div>
          <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2 }}>
            Follow <a href="https://x.com/BTB_Finance" target="_blank" rel="noreferrer" style={{ color: btb.text, textDecoration: 'underline' }}>@BTB_Finance</a> or join the <a href="https://discord.gg/bqFEPA56Tc" target="_blank" rel="noreferrer" style={{ color: btb.text, textDecoration: 'underline' }}>Discord</a> to catch the launch.
          </div>
        </div>
      </Glass>

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
