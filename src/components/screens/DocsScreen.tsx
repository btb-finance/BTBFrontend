'use client';
import { useState } from 'react';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { btb } from '../design-tokens';

const GUIDES = [
  { icon: 'rocket',  color: '#FFFFFF', bg: 'rgba(255,255,255,0.1)',  title: 'Getting started',  desc: 'Connect a wallet on Ethereum mainnet and the rest of the app unlocks.' },
  { icon: 'refresh', color: '#52E3A4', bg: 'rgba(82,227,164,0.15)',  title: 'How swaps work',   desc: 'Routes through KyberSwap for best-price across DEXs — no extra protocol fee on top.' },
  { icon: 'image',   color: '#FFB36B', bg: 'rgba(255,179,107,0.15)', title: 'BTB Bear NFT',     desc: '100k cap, 0.01 ETH per mint. Stake to earn BTBB from the 1% transfer tax pool.' },
  { icon: 'pie',     color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', title: 'Portfolio tracking', desc: 'Every ERC-20 you hold, priced from on-chain pools. Refreshed on demand.' },
];

const FAQS = [
  { q: 'What is BTB Finance?',         a: 'A single mini app that tries to be your everything-on-Ethereum: swap, portfolio, NFT mint + staking, protocol explorer, and an AI agent for your wallet (coming soon). Keep one tab open, do the whole stack from there.' },
  { q: 'What fees does BTB charge?',   a: 'No extra protocol fee on swaps — you pay the underlying KyberSwap routing cost and gas. NFT mint is 0.01 ETH flat. Staking is gas only; rewards come from the BTBB 1% transfer tax, not from your stake.' },
  { q: 'Which chains are supported?',  a: 'Ethereum mainnet only. The wallet is locked to chain 1 so you cannot accidentally swap or stake on the wrong network.' },
  { q: 'How does BTB Bear staking work?', a: 'Stake any BTB Bear NFT and earn a proportional share of the BTBB transfer tax. The reward pool is fungible — every staked Bear earns the same rate, and you can unstake any number at any time (no lock, no penalty).' },
  { q: 'Are NFT royalties enforced?',  a: 'Yes. 5% royalties are set on-chain via ERC-2981 and honored by every major marketplace.' },
  { q: 'Where does my balance data come from?', a: 'A Convex action fans a multicall across our RPC pool, batches balanceOf for every token in the list, and caches the snapshot per wallet. Prices come from DexScreener (deepest mainnet pool per token), refreshed every 5 minutes.' },
  { q: 'Is the code open source?',     a: 'Yes — contracts and frontend live at github.com/btb-finance. No audit yet; treat early balances as a beta.' },
];

const LINKS: { icon: string; color: string; label: string; sub: string; href: string }[] = [
  { icon: 'doc',     color: '#FFFFFF', label: 'Documentation', sub: 'Full protocol docs coming soon', href: 'https://github.com/btb-finance' },
  { icon: 'discord', color: '#5865F2', label: 'Discord',       sub: 'Join the community',             href: 'https://discord.gg/MYJz6KAFv' },
  { icon: 'twitter', color: '#fff',    label: 'X / Twitter',   sub: '@BTB_Finance',                   href: 'https://x.com/BTB_Finance' },
  { icon: 'github',  color: '#fff',    label: 'GitHub',        sub: 'Open source contracts',          href: 'https://github.com/btb-finance' },
  { icon: 'mail',    color: '#52E3A4', label: 'Support',       sub: 'hello@btb.finance',              href: 'mailto:hello@btb.finance' },
];

export function DocsScreen({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filteredFaqs = FAQS.filter(f =>
    f.q.toLowerCase().includes(search.toLowerCase()) ||
    f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 18px 100px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div onClick={onBack} style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(255,255,255,0.08)', border: btb.borderSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Icon name="back" size={18}/>
        </div>
        <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Docs & Help</div>
      </div>

      {/* vision pitch */}
      <Glass padding={20} radius={22} strong style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.15), transparent 55%), radial-gradient(circle at 100% 100%, rgba(255,179,107,0.18), transparent 55%)',
        }}/>
        <div style={{ position: 'relative' }}>
          <div style={{ color: '#FFB36B', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>The pitch</div>
          <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1.35, marginBottom: 8 }}>
            BTB Finance wants to be your everything-on-Ethereum app.
          </div>
          <div style={{ color: btb.textMuted, fontSize: 13, lineHeight: 1.55 }}>
            One mini app: swap any token at best price, see every holding with live USD, mint and stake BTB Bears, browse 60+ protocols, and (soon) hand it all off to an AI agent that watches your portfolio for you. No second wallet, no second tab.
          </div>
        </div>
      </Glass>

      {/* search */}
      <Glass padding={0} radius={18}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
          <Icon name="search" size={18} color={btb.textMuted}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search docs…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: btb.text, fontSize: 15, fontFamily: 'inherit',
            }}
          />
        </div>
      </Glass>

      {/* guides */}
      <div>
        <div style={{ color: btb.text, fontSize: 17, fontWeight: 700, marginBottom: 12, letterSpacing: -0.3 }}>Guides</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {GUIDES.map(g => (
            <Glass key={g.title} padding={16} radius={20} style={{ cursor: 'pointer' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: g.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
              }}>
                <Icon name={g.icon} size={20} color={g.color}/>
              </div>
              <div style={{ color: btb.text, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{g.title}</div>
              <div style={{ color: btb.textMuted, fontSize: 11, lineHeight: 1.4 }}>{g.desc}</div>
            </Glass>
          ))}
        </div>
      </div>

      {/* faq */}
      <div>
        <div style={{ color: btb.text, fontSize: 17, fontWeight: 700, marginBottom: 12, letterSpacing: -0.3 }}>FAQ</div>
        <Glass padding={0} radius={20}>
          {filteredFaqs.map((f, i) => (
            <div key={i} style={{ borderBottom: i < filteredFaqs.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }}
              >
                <span style={{ color: btb.text, fontSize: 14, fontWeight: 600, flex: 1, paddingRight: 10 }}>{f.q}</span>
                <Icon name={openFaq === i ? 'up' : 'down'} size={16} color={btb.textMuted}/>
              </div>
              {openFaq === i && (
                <div style={{ padding: '0 16px 14px', color: btb.textMuted, fontSize: 13, lineHeight: 1.6 }}>{f.a}</div>
              )}
            </div>
          ))}
          {filteredFaqs.length === 0 && (
            <div style={{ padding: 20, color: btb.textMuted, fontSize: 14, textAlign: 'center' }}>No results for &ldquo;{search}&rdquo;</div>
          )}
        </Glass>
      </div>

      {/* contact */}
      <div>
        <div style={{ color: btb.text, fontSize: 17, fontWeight: 700, marginBottom: 12, letterSpacing: -0.3 }}>Contact & Community</div>
        <Glass padding={0} radius={20}>
          {LINKS.map((l, i) => (
            <a key={l.label} href={l.href}
              target={l.href.startsWith('mailto:') ? undefined : '_blank'}
              rel={l.href.startsWith('mailto:') ? undefined : 'noreferrer'}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                borderBottom: i < LINKS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                cursor: 'pointer', textDecoration: 'none',
              }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', border: btb.borderSoft,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={l.icon} size={18} color={l.color}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: btb.text, fontSize: 14, fontWeight: 600 }}>{l.label}</div>
                <div style={{ color: btb.textMuted, fontSize: 12 }}>{l.sub}</div>
              </div>
              <Icon name="arrow" size={16} color="rgba(255,255,255,0.35)"/>
            </a>
          ))}
        </Glass>
      </div>

      {/* footer */}
      <div style={{ textAlign: 'center', color: btb.textDim, fontSize: 12, lineHeight: 1.8 }}>
        BTB Finance · Ethereum mainnet<br/>
        Open source at github.com/btb-finance
      </div>
    </div>
  );
}
