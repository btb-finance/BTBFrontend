'use client';
import { useState, useMemo } from 'react';
import { useConnection, useConfig, useReadContracts } from 'wagmi';
import { erc20Abi, encodeFunctionData, parseUnits, formatUnits, type ContractFunctionParameters } from 'viem';
import { useTx } from '@/lib/TxTracker';
import { runCalls, type Call } from '@/lib/txRunner';
import { Glass } from '../Glass';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { Portal } from '../Portal';
import { Screen } from '../Screen';
import { Badge } from '../Badge';
import { Spinner } from '../Spinner';
import { TokenIcon } from '../TokenIcon';
import { btb } from '../design-tokens';
import { useSidebar } from '../../lib/SidebarContext';
import {
  type YearnVault, useYearnVaults, useYearnPositions,
  sharesToUnderlying, yearnUrl,
  V2_VAULT_ABI, V3_VAULT_ABI, VEYFI_GAUGE_ABI, STAKING_REWARDS_ABI, EARNED_ABI,
} from '../../lib/yearn';

// ─── Featured Yearn products (yLockers & governance staking) ────────────────
// Addresses from https://docs.yearn.fi/developers/addresses/ — the yCRV / yYB
// auto-compounders are regular vaults in ydaemon, so deposits reuse the vault
// modal. stYFI uses its own staking contracts, so it links out to the official
// app.
type FeaturedProduct = {
  id: string;
  title: string;
  tagline: string;
  url: string;                     // official product app
  color: string;
  vaultAddress?: `0x${string}`;    // matching ydaemon vault → in-app deposits
  convertHint?: string;            // shown in the modal (e.g. how to get yCRV)
};

const FEATURED_PRODUCTS: FeaturedProduct[] = [
  {
    id: 'styfi', title: 'stYFI', color: '#38BDF8',
    tagline: 'Stake YFI for governance power and yvUSDC rewards',
    url: 'https://styfi.yearn.fi',
  },
  {
    id: 'ycrv', title: 'yCRV', color: '#52E3A4',
    tagline: 'CRV liquid locker: st-yCRV auto compounds boosted Curve yield',
    url: 'https://ycrv.yearn.fi',
    vaultAddress: '0x27B5739e22ad9033bcBf192059122d163b60349D',
    convertHint: 'Deposits take yCRV. Hold plain CRV? Convert it 1:1 at ycrv.yearn.fi first.',
  },
  {
    id: 'yyb', title: 'yYB', color: '#FFB36B',
    tagline: 'Yield Basis liquid locker: stake yYB and auto compound YB rewards',
    url: 'https://yyb.yearn.fi',
    vaultAddress: '0x1F6f16945e395593d8050d6Cc33e4328a515B648',
    convertHint: 'Deposits take yYB. Hold plain YB? Convert it at yyb.yearn.fi first.',
  },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmtPct = (n: number | null) => (n == null ? '—' : `${(n * 100).toFixed(2)}%`);
const fmtTvl = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`;
const fmtAmt = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 2 : 6 });

// ─── Deposit / withdraw / stake modal ────────────────────────────────────────

type Action = 'deposit' | 'withdraw' | 'stake' | 'unstake';

function VaultModal({ vault, viewAddress, hint, onClose, onConnect }: {
  vault: YearnVault;
  viewAddress?: string;
  hint?: { text: string; url: string };
  onClose: () => void;
  onConnect?: () => void;
}) {
  const { address } = useConnection();       // signer — read-only imports can't transact
  const owner = (address ?? viewAddress) as `0x${string}` | undefined;
  const config = useConfig();
  const { track } = useTx();
  const { width: sidebarWidth } = useSidebar();

  const staking = vault.staking;
  const tabs: Action[] = staking ? ['deposit', 'withdraw', 'stake', 'unstake'] : ['deposit', 'withdraw'];

  const [tab, setTab] = useState<Action>('deposit');
  const [amt, setAmt] = useState('');
  const [maxed, setMaxed] = useState(false);  // MAX → exit full balance, no rounding dust
  const [busy, setBusy] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const modalContracts: ContractFunctionParameters[] = owner ? [
    { address: vault.token.address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
    { address: vault.address,       abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
    { address: vault.token.address, abi: erc20Abi, functionName: 'allowance', args: [owner, vault.address] },
    ...(staking ? [
      { address: staking.address, abi: erc20Abi,   functionName: 'balanceOf', args: [owner] },
      { address: staking.address, abi: EARNED_ABI, functionName: 'earned',    args: [owner] },
      { address: vault.address,   abi: erc20Abi,   functionName: 'allowance', args: [owner, staking.address] },
    ] satisfies ContractFunctionParameters[] : []),
  ] : [];
  const reads = useReadContracts({
    contracts: modalContracts,
    query: { enabled: !!owner },
  });
  const tokenBal       = (reads.data?.[0]?.result as bigint | undefined) ?? 0n;
  const shareBal       = (reads.data?.[1]?.result as bigint | undefined) ?? 0n;
  const allowance      = (reads.data?.[2]?.result as bigint | undefined) ?? 0n;
  const stakedBal      = (reads.data?.[3]?.result as bigint | undefined) ?? 0n; // gauge shares, 1:1 with yv shares
  const earned         = (reads.data?.[4]?.result as bigint | undefined) ?? 0n;
  const stakeAllowance = (reads.data?.[5]?.result as bigint | undefined) ?? 0n;

  const depositedAssets = sharesToUnderlying(shareBal + stakedBal, vault);
  const walletNum    = parseFloat(formatUnits(tokenBal, vault.token.decimals));
  const depositedNum = parseFloat(formatUnits(depositedAssets, vault.token.decimals));
  const sharesNum    = parseFloat(formatUnits(shareBal, vault.decimals));
  const stakedNum    = parseFloat(formatUnits(stakedBal, vault.decimals));
  const earnedNum    = parseFloat(formatUnits(earned, 18));

  // deposit/withdraw are denominated in the underlying token; stake/unstake in
  // yv shares (what the gauge actually holds)
  const isShareAction = tab === 'stake' || tab === 'unstake';
  const unit = isShareAction ? vault.symbol : vault.token.symbol;
  const available = tab === 'deposit' ? walletNum
    : tab === 'withdraw' ? parseFloat(formatUnits(sharesToUnderlying(shareBal, vault), vault.token.decimals))
    : tab === 'stake' ? sharesNum
    : stakedNum;

  const setInput = (v: string) => { setAmt(v); setMaxed(false); setMsg(null); };
  const setMax = () => {
    setMsg(null);
    setMaxed(tab !== 'deposit');
    if (tab === 'deposit')       setAmt(formatUnits(tokenBal, vault.token.decimals));
    else if (tab === 'withdraw') setAmt(formatUnits(sharesToUnderlying(shareBal, vault), vault.token.decimals));
    else if (tab === 'stake')    setAmt(formatUnits(shareBal, vault.decimals));
    else                         setAmt(formatUnits(stakedBal, vault.decimals));
  };
  const switchTab = (t: Action) => { setTab(t); setAmt(''); setMaxed(false); setMsg(null); };

  async function run() {
    if (!address || !amt || parseFloat(amt) <= 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const calls: Call[] = [];
      let label = '';

      if (tab === 'deposit') {
        const assets = parseUnits(amt, vault.token.decimals);
        if (allowance < assets) {
          calls.push({
            to: vault.token.address,
            data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [vault.address, assets] }),
          });
        }
        calls.push({
          to: vault.address,
          data: vault.isV3
            ? encodeFunctionData({ abi: V3_VAULT_ABI, functionName: 'deposit', args: [assets, address] })
            : encodeFunctionData({ abi: V2_VAULT_ABI, functionName: 'deposit', args: [assets] }),
        });
        label = `Deposit ${vault.token.symbol} → ${vault.symbol}`;

      } else if (tab === 'withdraw') {
        if (maxed || vault.pricePerShare === 0n) {
          // exit the full position in shares — avoids leaving rounding dust
          calls.push({
            to: vault.address,
            data: vault.isV3
              ? encodeFunctionData({ abi: V3_VAULT_ABI, functionName: 'redeem', args: [shareBal, address, address] })
              : encodeFunctionData({ abi: V2_VAULT_ABI, functionName: 'withdraw', args: [shareBal] }),
          });
        } else {
          const assets = parseUnits(amt, vault.token.decimals);
          if (vault.isV3) {
            calls.push({
              to: vault.address,
              data: encodeFunctionData({ abi: V3_VAULT_ABI, functionName: 'withdraw', args: [assets, address, address] }),
            });
          } else {
            const shares = (assets * 10n ** BigInt(vault.decimals)) / vault.pricePerShare;
            calls.push({
              to: vault.address,
              data: encodeFunctionData({ abi: V2_VAULT_ABI, functionName: 'withdraw', args: [shares > shareBal ? shareBal : shares] }),
            });
          }
        }
        label = `Withdraw ${vault.token.symbol} from ${vault.symbol}`;

      } else if (tab === 'stake' && staking) {
        const shares = maxed ? shareBal : parseUnits(amt, vault.decimals);
        if (stakeAllowance < shares) {
          calls.push({
            to: vault.address,
            data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [staking.address, shares] }),
          });
        }
        calls.push({
          to: staking.address,
          data: staking.source === 'VeYFI'
            ? encodeFunctionData({ abi: VEYFI_GAUGE_ABI, functionName: 'deposit', args: [shares, address] })
            : encodeFunctionData({ abi: STAKING_REWARDS_ABI, functionName: 'stake', args: [shares] }),
        });
        label = `Stake ${vault.symbol}`;

      } else if (tab === 'unstake' && staking) {
        const shares = maxed ? stakedBal : parseUnits(amt, vault.decimals);
        calls.push({
          to: staking.address,
          data: staking.source === 'VeYFI'
            ? encodeFunctionData({ abi: VEYFI_GAUGE_ABI, functionName: 'redeem', args: [shares, address, address] })
            : encodeFunctionData({ abi: STAKING_REWARDS_ABI, functionName: 'withdraw', args: [shares] }),
        });
        label = `Unstake ${vault.symbol}`;
      }

      await runCalls(config, { account: address, calls, label, track });
      setAmt('');
      setMaxed(false);
      setMsg({ ok: true, text: `${tab[0].toUpperCase()}${tab.slice(1)} confirmed` });
      reads.refetch();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.shortMessage ?? e?.message ?? 'Transaction failed' });
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    if (!address || !staking) return;
    setClaiming(true);
    setMsg(null);
    try {
      await runCalls(config, {
        account: address,
        calls: [{
          to: staking.address,
          data: staking.source === 'VeYFI'
            ? encodeFunctionData({ abi: VEYFI_GAUGE_ABI, functionName: 'getReward', args: [address] })
            : encodeFunctionData({ abi: STAKING_REWARDS_ABI, functionName: 'getReward', args: [] }),
        }],
        label: `Claim ${staking.rewardSymbol}`,
        track,
      });
      setMsg({ ok: true, text: `${staking.rewardSymbol} claimed` });
      reads.refetch();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.shortMessage ?? e?.message ?? 'Claim failed' });
    } finally {
      setClaiming(false);
    }
  }

  const amtNum = parseFloat(amt || '0');
  const insufficient = !maxed && amtNum > available;
  const canSubmit = !!address && amtNum > 0 && !insufficient && !busy;

  const usdEstimate = amtNum > 0 && vault.tokenPrice > 0
    ? (isShareAction
        ? amtNum * parseFloat(formatUnits(vault.pricePerShare, vault.decimals)) * vault.tokenPrice
        : amtNum * vault.tokenPrice)
    : null;

  const ACTION_LABEL: Record<Action, string> = {
    deposit: 'Amount to deposit', withdraw: 'Amount to withdraw',
    stake: 'Shares to stake', unstake: 'Shares to unstake',
  };

  return (
    <Portal>
      <div onClick={onClose} style={{
        position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          width: '100%', maxWidth: 460, background: 'rgba(10,10,15,0.98)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 28, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <TokenIcon symbol={vault.token.symbol} size={40} logoUrl={vault.token.icon}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: btb.text, fontSize: 16, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vault.name}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                <Badge color={vault.isV3 ? '#38BDF8' : '#94A3B8'} bg={vault.isV3 ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.15)'} border="none">{vault.isV3 ? 'V3' : 'V2'}</Badge>
                {staking && <Badge color="#A78BFA" bg="rgba(167,139,250,0.15)" border="none">STAKING</Badge>}
              </div>
            </div>
            <div onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <Icon name="close" size={15} color={btb.textMuted}/>
            </div>
          </div>

          {/* stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Net APY', value: fmtPct(vault.apy), color: '#52E3A4' },
              { label: 'TVL', value: fmtTvl(vault.tvlUsd), color: btb.text },
              { label: 'Your deposit', value: owner ? fmtAmt(depositedNum) : '—', color: btb.text },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: btb.borderSoft, borderRadius: 14, padding: '10px 12px' }}>
                <div style={{ color: btb.textDim, fontSize: 11, marginBottom: 3 }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: 14, fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* staking summary + claim */}
          {staking && owner && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 14, padding: '10px 12px' }}>
              <Icon name="stake" size={16} color="#A78BFA"/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 700 }}>
                  {fmtAmt(stakedNum)} {vault.symbol} staked
                </div>
                <div style={{ color: btb.textMuted, fontSize: 11.5 }}>
                  Claimable: {fmtAmt(earnedNum)} {staking.rewardSymbol}
                </div>
              </div>
              {address && earned > 0n && (
                <Button size="sm" variant="ghost" loading={claiming} onClick={claim} style={{ height: 34, width: 84, flexShrink: 0 }}>
                  Claim
                </Button>
              )}
            </div>
          )}

          {/* product hint (e.g. featured lockers needing a convert step) */}
          {hint && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,179,107,0.08)', border: '1px solid rgba(255,179,107,0.25)', borderRadius: 14, padding: '10px 12px' }}>
              <Icon name="launch" size={15} color="#FFB36B"/>
              <div style={{ flex: 1, color: btb.textMuted, fontSize: 12, lineHeight: 1.45 }}>
                {hint.text}{' '}
                <a href={hint.url} target="_blank" rel="noreferrer" style={{ color: btb.text, textDecoration: 'underline' }}>Open ↗</a>
              </div>
            </div>
          )}

          {/* tabs */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 4 }}>
            {tabs.map(t => (
              <div key={t} onClick={() => switchTab(t)} style={{
                flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 11, cursor: 'pointer',
                background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: tab === t ? btb.text : btb.textMuted, fontSize: 13, fontWeight: 700, textTransform: 'capitalize',
              }}>{t}</div>
            ))}
          </div>

          {/* amount input */}
          <div style={{ background: 'rgba(255,255,255,0.06)', border: btb.borderSoft, borderRadius: 16, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: btb.textMuted, fontSize: 12 }}>{ACTION_LABEL[tab]}</span>
              <span style={{ color: btb.textMuted, fontSize: 12 }}>Available: {fmtAmt(available)} {unit}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                value={amt}
                onChange={e => setInput(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0.0"
                inputMode="decimal"
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 22, fontWeight: 700, fontFamily: 'inherit' }}
              />
              <div onClick={setMax} style={{
                padding: '5px 10px', borderRadius: 999, cursor: 'pointer', flexShrink: 0,
                background: 'rgba(82,227,164,0.15)', color: '#52E3A4', fontSize: 12, fontWeight: 700,
              }}>MAX</div>
              <span style={{ color: btb.text, fontSize: 14, fontWeight: 700, flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit}</span>
            </div>
            {usdEstimate != null && (
              <div style={{ color: btb.textDim, fontSize: 12, marginTop: 4 }}>
                ≈ ${usdEstimate.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </div>
            )}
          </div>

          {msg && (
            <div style={{ color: msg.ok ? '#52E3A4' : btb.loss, fontSize: 13, textAlign: 'center' }}>{msg.text}</div>
          )}
          {insufficient && amtNum > 0 && (
            <div style={{ color: btb.loss, fontSize: 12.5, textAlign: 'center' }}>
              Amount exceeds your {tab === 'deposit' ? 'wallet balance' : tab === 'withdraw' ? 'deposit' : tab === 'stake' ? 'unstaked shares' : 'staked shares'}
            </div>
          )}

          {address ? (
            <Button size="md" fullWidth loading={busy} disabled={!canSubmit} onClick={run} style={{ textTransform: 'capitalize' }}>
              {tab} {unit}
            </Button>
          ) : (
            <Button size="md" fullWidth onClick={onConnect}>Connect wallet</Button>
          )}

          <div style={{ color: btb.textDim, fontSize: 11.5, textAlign: 'center', lineHeight: 1.5 }}>
            {staking && `Stake your ${vault.symbol} shares to earn ${staking.rewardSymbol} on top of the vault APY. `}
            Vault by Yearn ·{' '}
            <a href={yearnUrl(vault)} target="_blank" rel="noreferrer" style={{ color: btb.textMuted, textDecoration: 'underline' }}>
              view on yearn.fi
            </a>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ─── Vault row ───────────────────────────────────────────────────────────────

function VaultRow({ vault, deposited, onClick }: { vault: YearnVault; deposited?: number; onClick: () => void }) {
  return (
    <Glass padding={14} radius={18} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <TokenIcon symbol={vault.token.symbol} size={38} logoUrl={vault.token.icon}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ color: btb.text, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vault.name}</span>
            <Badge color={vault.isV3 ? '#38BDF8' : '#94A3B8'} bg={vault.isV3 ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.15)'} border="none" style={{ flexShrink: 0 }}>{vault.isV3 ? 'V3' : 'V2'}</Badge>
            {vault.staking && (
              <Badge color="#A78BFA" bg="rgba(167,139,250,0.15)" border="none" style={{ flexShrink: 0 }}>STAKING</Badge>
            )}
          </div>
          <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2 }}>
            {vault.token.symbol} · TVL {fmtTvl(vault.tvlUsd)}
            {deposited != null && deposited > 0 && (
              <span style={{ color: '#52E3A4' }}> · {fmtAmt(deposited)} deposited</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ color: '#52E3A4', fontSize: 15, fontWeight: 800 }}>{fmtPct(vault.apy)}</div>
          <div style={{ color: btb.textDim, fontSize: 11 }}>
            {vault.stakingApr ? `+${fmtPct(vault.stakingApr)} staking` : vault.staking ? `+${vault.staking.rewardSymbol} staking` : 'APY'}
          </div>
        </div>
      </div>
    </Glass>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function EarnScreen({ onBack, address: viewAddress, onConnect }: {
  onBack: () => void;
  address?: string;
  onConnect?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'staking'>('all');
  const [selected, setSelected] = useState<{ vault: YearnVault; hint?: { text: string; url: string } } | null>(null);

  const { vaults, error, reload } = useYearnVaults();
  // yv-share + staked-gauge balances across all listed vaults (multicalled by
  // wagmi) — staked shares count toward positions too
  const { positions } = useYearnPositions(viewAddress, vaults);
  const depositedByVault = useMemo(
    () => new Map(positions.map(p => [p.vault.address, p.underlying])),
    [positions],
  );

  const ql = query.toLowerCase();
  const filtered = (vaults ?? []).filter(v =>
    (filter === 'all' || !!v.staking) &&
    (!ql ||
      v.name.toLowerCase().includes(ql) ||
      v.symbol.toLowerCase().includes(ql) ||
      v.token.symbol.toLowerCase().includes(ql))
  );
  const mine = filtered.filter(v => (depositedByVault.get(v.address) ?? 0) > 0);
  const rest = filtered.filter(v => !(depositedByVault.get(v.address) ?? 0));

  return (
    <Screen gap={20}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div onClick={onBack} style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(255,255,255,0.08)', border: btb.borderSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Icon name="back" size={18}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Earn</div>
          <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 2 }}>Yearn vaults and staking on Ethereum. Deposit once, yield compounds itself.</div>
        </div>
        <Badge color="#52E3A4" bg="rgba(82,227,164,0.15)" border="none" style={{ flexShrink: 0 }}>POWERED BY YEARN</Badge>
      </div>

      {/* search + filter */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', border: btb.borderSoft, borderRadius: 14, padding: '10px 14px' }}>
          <Icon name="search" size={16} color={btb.textMuted}/>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search vaults: USDC, ETH, crvUSD…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 14, fontFamily: 'inherit' }}/>
        </div>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 4, flexShrink: 0 }}>
          {([['all', 'All'], ['staking', 'Staking']] as const).map(([id, label]) => (
            <div key={id} onClick={() => setFilter(id)} style={{
              padding: '7px 14px', borderRadius: 11, cursor: 'pointer',
              background: filter === id ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: filter === id ? btb.text : btb.textMuted, fontSize: 13, fontWeight: 700,
            }}>{label}</div>
          ))}
        </div>
      </div>

      {/* featured Yearn products — stYFI, yCRV, yYB */}
      {vaults && !query && filter === 'all' && (
        <div>
          <div style={{ color: btb.text, fontSize: 16, fontWeight: 700, marginBottom: 10, letterSpacing: -0.3 }}>Yearn products</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {FEATURED_PRODUCTS.map(p => {
              const vault = p.vaultAddress
                ? vaults.find(v => v.address.toLowerCase() === p.vaultAddress!.toLowerCase())
                : undefined;
              const open = () => {
                if (vault) setSelected({ vault, hint: p.convertHint ? { text: p.convertHint, url: p.url } : undefined });
                else window.open(p.url, '_blank', 'noopener');
              };
              return (
                <Glass key={p.id} padding={16} radius={20} onClick={open} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: p.color, fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>{p.title}</span>
                    <div
                      onClick={e => { e.stopPropagation(); window.open(p.url, '_blank', 'noopener'); }}
                      title={`Open ${p.url.replace('https://', '')}`}
                      style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <Icon name="launch" size={13} color={btb.textMuted}/>
                    </div>
                  </div>
                  <div style={{ color: btb.textMuted, fontSize: 12, lineHeight: 1.45, flex: 1 }}>{p.tagline}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    {vault ? (
                      <>
                        <span style={{ color: p.color, fontSize: 17, fontWeight: 800 }}>{fmtPct(vault.apy)}</span>
                        <span style={{ color: btb.textDim, fontSize: 11 }}>APY · TVL {fmtTvl(vault.tvlUsd)}</span>
                      </>
                    ) : (
                      <span style={{ color: btb.textDim, fontSize: 11.5 }}>Stake on {p.url.replace('https://', '')} ↗</span>
                    )}
                  </div>
                </Glass>
              );
            })}
          </div>
        </div>
      )}

      {/* states */}
      {!vaults && !error && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spinner size={36} color="#FFFFFF" track="rgba(255,255,255,0.18)"/>
        </div>
      )}
      {error && (
        <Glass padding={20} radius={20} style={{ textAlign: 'center' }}>
          <div style={{ color: btb.textMuted, fontSize: 14, marginBottom: 12 }}>Couldn&rsquo;t load Yearn vaults ({error})</div>
          <Button size="sm" variant="ghost" onClick={reload} style={{ margin: '0 auto', width: 120 }}>Retry</Button>
        </Glass>
      )}

      {/* your positions */}
      {mine.length > 0 && (
        <div>
          <div style={{ color: btb.text, fontSize: 16, fontWeight: 700, marginBottom: 10, letterSpacing: -0.3 }}>Your positions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mine.map(v => (
              <VaultRow key={v.address} vault={v} deposited={depositedByVault.get(v.address)} onClick={() => setSelected({ vault: v })}/>
            ))}
          </div>
        </div>
      )}

      {/* all vaults */}
      {vaults && (
        <div>
          <div style={{ color: btb.text, fontSize: 16, fontWeight: 700, marginBottom: 10, letterSpacing: -0.3 }}>
            {mine.length > 0 ? 'All vaults' : 'Vaults'}
          </div>
          {rest.length === 0 && mine.length === 0 && (
            <div style={{ color: btb.textMuted, fontSize: 14, textAlign: 'center', padding: 24 }}>No vaults match your search</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rest.map(v => (
              <VaultRow key={v.address} vault={v} onClick={() => setSelected({ vault: v })}/>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <VaultModal vault={selected.vault} hint={selected.hint} viewAddress={viewAddress} onClose={() => setSelected(null)} onConnect={onConnect}/>
      )}
    </Screen>
  );
}
