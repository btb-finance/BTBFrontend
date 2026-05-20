'use client';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { btb } from '../design-tokens';

// Curated DeFi explorer — each card is a category that opens a list of
// well-known protocols in `ProtocolScreen`. Metrics are *example protocols*
// in that category, not fabricated TVL.
const PRODUCTS = [
  { icon: 'bank',   color: '#52E3A4', bg: 'rgba(82,227,164,0.15)',   name: 'Lending',          desc: 'Supply assets and borrow against your portfolio.',           metric: 'Aave · Morpho · Compound',      category: 'lending'           },
  { icon: 'chart',  color: '#FFFFFF', bg: 'rgba(255,255,255,0.1)',   name: 'Perpetuals',       desc: 'Leveraged on-chain trading on major DEXs.',                  metric: 'GMX · dYdX · Hyperliquid',      category: 'perps'             },
  { icon: 'bridge', color: '#FFB36B', bg: 'rgba(255,179,107,0.15)',  name: 'Bridge',           desc: 'Move assets across chains in seconds.',                      metric: 'Across · Stargate · Hop',       category: 'bridge'            },
  { icon: 'vault',  color: '#94A3B8', bg: 'rgba(148,163,184,0.15)',  name: 'Yield Vaults',     desc: 'Auto-compound strategies with one click.',                   metric: 'Yearn · Beefy · Pendle',        category: 'vaults'            },
  { icon: 'launch', color: '#F472B6', bg: 'rgba(244,114,182,0.15)',  name: 'Launchpad',        desc: 'Curated token launches and IDO platforms.',                  metric: 'Fjord · Bounce · Gempad',       category: 'launchpad'         },
  { icon: 'shield', color: '#52E3A4', bg: 'rgba(82,227,164,0.15)',   name: 'Insurance',        desc: 'Cover your positions against smart-contract risk.',          metric: 'Nexus Mutual · InsurAce',       category: 'insurance'         },
  { icon: 'stake',  color: '#38BDF8', bg: 'rgba(56,189,248,0.15)',   name: 'Liquid Staking',   desc: 'Stake ETH and keep liquidity with stETH, rETH and more.',    metric: 'Lido · Rocket Pool · Frax',     category: 'liquid-staking'    },
  { icon: 'stake',  color: '#818CF8', bg: 'rgba(129,140,248,0.15)',  name: 'Restaking',        desc: 'Restake ETH to secure AVSs and earn extra yield.',           metric: 'EigenLayer · Ether.fi · Renzo', category: 'liquid-restaking'  },
  { icon: 'bank',   color: '#FBBF24', bg: 'rgba(251,191,36,0.15)',   name: 'RWA',              desc: 'Tokenised treasuries, credit, and real-world assets.',       metric: 'Ondo · Maple · Centrifuge',     category: 'rwa'               },
  { icon: 'vault',  color: '#34D399', bg: 'rgba(52,211,153,0.15)',   name: 'CDP',              desc: 'Mint stablecoins like DAI and LUSD against your crypto.',    metric: 'Sky (Maker) · Liquity',         category: 'cdp'               },
  { icon: 'chart',  color: '#F87171', bg: 'rgba(248,113,113,0.15)',  name: 'Options',          desc: 'On-chain options, structured products, vaults.',             metric: 'Lyra · Premia · Ribbon',        category: 'options'           },
];

export function ProductsScreen({ onBack, onCategory }: { onBack: () => void; onCategory?: (c: string) => void }) {
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
        <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Explore DeFi</div>
      </div>

      {/* honest hero — what this screen actually is */}
      <Glass padding={20} radius={24} strong style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(30,41,59,0.4))',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(circle at 10% 0%, rgba(255,255,255,0.18), transparent 55%), radial-gradient(circle at 100% 100%, rgba(255,179,107,0.18), transparent 55%)',
        }}/>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'rgba(226,232,240,0.2)', border: '1px solid rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="map" size={22} color="#FFFFFF"/>
            </div>
            <span style={{ background: 'rgba(82,227,164,0.18)', color: '#52E3A4', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, letterSpacing: 0.4 }}>EVERYTHING APP</span>
          </div>
          <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 6 }}>Every protocol, one tab</div>
          <div style={{ color: btb.textMuted, fontSize: 14, lineHeight: 1.5 }}>
            BTB is wiring up the rest of DeFi alongside its own swap, portfolio, and NFT stack. Browse the categories below to jump into curated, well-known protocols for lending, perps, vaults, restaking, RWA and more.
          </div>
        </div>
      </Glass>

      {/* grid */}
      <div>
        <div style={{ color: btb.text, fontSize: 17, fontWeight: 700, marginBottom: 12, letterSpacing: -0.3 }}>Categories</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {PRODUCTS.map(p => (
            <Glass key={p.name} padding={16} radius={20} onClick={() => p.category && onCategory?.(p.category)} style={{ cursor: p.category ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11, background: p.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={p.icon} size={20} color={p.color}/>
              </div>
              <div style={{ color: btb.text, fontSize: 13, fontWeight: 700 }}>{p.name}</div>
              <div style={{ color: btb.textMuted, fontSize: 11, lineHeight: 1.4, flex: 1 }}>{p.desc}</div>
              <div style={{ color: p.color, fontSize: 11, fontWeight: 700 }}>{p.metric}</div>
            </Glass>
          ))}
        </div>
      </div>
    </div>
  );
}
