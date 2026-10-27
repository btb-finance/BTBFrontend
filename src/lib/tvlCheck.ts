import { erc20Abi, type PublicClient } from 'viem';
import type { EarnPool } from './pools';
import { CHAIN_DATA_NETWORKS } from './chainDataNetworks';
import { withSafeMulticall } from './safeMulticall';
import { POSITION_MANAGER_ABI, STATE_VIEW_ABI } from '@/protocols/dexs/uniswap/v4/abis';
import { uniswapV4DeploymentForChain } from '@/protocols/dexs/uniswap/v4/addresses';
import { wrappedNativeFor } from '@/protocols/lpChains';

const wrappedNativeOf = (chainId: number) => wrappedNativeFor(chainId).toLowerCase();

/**
 * Drop pools whose TVL is not backed by real money (Discover, 2026-10-26).
 *
 * The coverage feeds take a pool's TVL from DexScreener and GeckoTerminal, which price a token from its own pool.
 * A token minted in the billions and paired with a sliver of WETH then reads as hundreds of millions: on Base a farm
 * of "AROS/WETH" and "NTDA/WETH" V4 pools, each a different contract under the same symbol, each claimed about
 * $330M while holding about $100 of WETH; a BNB pair claimed $2 quadrillion.
 *
 * A pool of at least CHECK_FROM_USD is checked once:
 * - both tokens have an independent price (DefiLlama, confidence 0.8 or more): kept, its TVL is real prices;
 * - one has: the real side is measured on chain and the pool is dropped when twice that is under a quarter of the
 *   claimed TVL. A pool with its own address is measured by its balance of that token. A V4 pool's reading (the
 *   active liquidity's reserve at the current price) overstates narrow ranges, so it can only reject: a V4 pool
 *   with one unpriced token is kept up to $5M;
 * - neither has: dropped, nothing backs the figure.
 * A pool the chain read cannot measure is kept up to $5M, so an RPC hiccup never empties Discover. Checked rows carry `tvlChecked`, so
 * later saves skip them.
 */

const CHECK_FROM_USD = 250_000;
const MIN_CONFIDENCE = 0.8;
/** Kept when the real side, doubled, covers at least this share of the claimed TVL. */
const MIN_BACKED_SHARE = 0.25;
/** A one-sided pool the chain read cannot measure is kept only up to this TVL. */
const UNMEASURED_MAX_USD = 5_000_000;
const Q96 = 2n ** 96n;
const ZERO = '0x0000000000000000000000000000000000000000';

export type LlamaCoin = { price?: number; decimals?: number; confidence?: number };

export async function llamaPrices(keys: string[]): Promise<Map<string, LlamaCoin>> {
  const out = new Map<string, LlamaCoin>();
  for (let i = 0; i < keys.length; i += 80) {
    const batch = keys.slice(i, i + 80);
    const res = await fetch(`https://coins.llama.fi/prices/current/${batch.join(',')}`, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!res?.ok) continue;
    const json = (await res.json().catch(() => ({}))) as { coins?: Record<string, LlamaCoin> };
    for (const [k, v] of Object.entries(json.coins ?? {})) out.set(k.toLowerCase(), v);
  }
  return out;
}

const isAddress = (s: string) => /^0x[0-9a-f]{40}$/i.test(s);

/**
 * The pools to keep, with `tvlChecked` set on every one that was looked at. `clientFor` gives a chain's client for
 * the on-chain reads; a chain without one keeps its unpriced pools (cannot be measured).
 */
export async function dropUnbackedTvl(pools: EarnPool[], clientFor: (chainId: number) => PublicClient | null): Promise<EarnPool[]> {
  const slugOf = (p: EarnPool) => (p.chainId != null ? CHAIN_DATA_NETWORKS[p.chainId]?.llama : undefined);
  const due = pools.filter((p) => !p.tvlChecked && p.tvlUsd >= CHECK_FROM_USD && slugOf(p) && (p.underlyingTokens?.length ?? 0) >= 2
    && p.underlyingTokens!.slice(0, 2).every(isAddress));
  if (due.length === 0) return pools;

  const keyOf = (p: EarnPool, t: string) => `${slugOf(p)}:${t.toLowerCase()}`;
  const prices = await llamaPrices([...new Set(due.flatMap((p) => p.underlyingTokens!.slice(0, 2).map((t) => keyOf(p, t))))]);
  const priced = (p: EarnPool, t: string) => {
    const c = prices.get(keyOf(p, t));
    return c && (c.price ?? 0) > 0 && (c.confidence ?? 0) >= MIN_CONFIDENCE ? c : null;
  };

  const drop = new Set<EarnPool>();
  // One priced side: measure it on chain, per chain in one multicall.
  const oneSided = new Map<number, { p: EarnPool; token: string; coin: LlamaCoin }[]>();
  for (const p of due) {
    const [a, b] = p.underlyingTokens!.slice(0, 2);
    const ca = priced(p, a), cb = priced(p, b);
    if (ca && cb) continue;
    if (!ca && !cb) { drop.add(p); continue; }
    const list = oneSided.get(p.chainId!) ?? [];
    list.push({ p, token: (ca ? a : b).toLowerCase(), coin: (ca ?? cb)! });
    oneSided.set(p.chainId!, list);
  }

  for (const [chainId, list] of oneSided) {
    const client = clientFor(chainId);
    if (!client) { for (const { p } of list) if (p.tvlUsd > UNMEASURED_MAX_USD) drop.add(p); continue; }
    const v4 = uniswapV4DeploymentForChain(chainId);
    const mc = withSafeMulticall(client);
    // A pool with its own address holds its tokens; a V4 pool (a 32 byte id) sits in the PoolManager, so its key
    // and active liquidity are read instead.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contracts: any[] = list.flatMap(({ p, token }): any[] => isAddress(p.id)
      ? [{ address: token as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf' as const, args: [p.id as `0x${string}`] }]
      : v4 && /^0x[0-9a-f]{64}$/i.test(p.id)
        ? [
          { address: v4.positionManager, abi: POSITION_MANAGER_ABI, functionName: 'poolKeys' as const, args: [p.id.slice(0, 52) as `0x${string}`] },
          { address: v4.stateView, abi: STATE_VIEW_ABI, functionName: 'getSlot0' as const, args: [p.id as `0x${string}`] },
          { address: v4.stateView, abi: STATE_VIEW_ABI, functionName: 'getLiquidity' as const, args: [p.id as `0x${string}`] },
        ]
        : []);
    const res = contracts.length ? await mc.multicall({ contracts, allowFailure: true }).catch(() => null) : null;
    if (!res) { for (const { p } of list) if (p.tvlUsd > UNMEASURED_MAX_USD) drop.add(p); continue; }
    let i = 0;
    for (const { p, token, coin } of list) {
      const decimals = coin.decimals ?? 18;
      let raw: bigint | null = null;
      if (isAddress(p.id)) {
        const r = res[i++];
        raw = r?.status === 'success' ? (r.result as bigint) : null;
      } else if (v4 && /^0x[0-9a-f]{64}$/i.test(p.id)) {
        const [k, s, l] = [res[i++], res[i++], res[i++]];
        if (s?.status === 'success' && l?.status === 'success') {
          const sqrtP = (s.result as readonly bigint[])[0];
          const L = l.result as bigint;
          const reserve = (side: 0 | 1) => (side === 0 ? (L * Q96) / sqrtP : (L * sqrtP) / Q96);
          const [c0, c1] = k?.status === 'success' ? (k.result as readonly [`0x${string}`, `0x${string}`]) : [ZERO, ZERO];
          const known = c0 !== ZERO || c1 !== ZERO;
          // Native ETH is currency 0x0 in V4 while the list names the wrapped token.
          const native = (c: string) => c === ZERO;
          if (sqrtP > 0n && known) {
            const side = c0.toLowerCase() === token || (native(c0) && c1.toLowerCase() !== token) ? 0
              : c1.toLowerCase() === token || native(c1) ? 1 : null;
            if (side != null) raw = reserve(side);
          } else if (sqrtP > 0n) {
            // A pool made outside the PositionManager has no key there. Currencies sort by address, so the priced
            // token sits where it sorts, or first as native ETH when it is the wrapped native. A wrong reading gives
            // an impossible amount (billions of ETH), so readings far above the claim are discarded and the larger
            // plausible one is used: unsure means kept.
            const [t0] = p.underlyingTokens!.slice(0, 2).map((t) => t.toLowerCase()).sort();
            const sides = new Set<0 | 1>([token === t0 ? 0 : 1]);
            if (token === wrappedNativeOf(chainId)) sides.add(0);
            const plausible = [...sides].map(reserve).filter((r) => (Number(r) / 10 ** (coin.decimals ?? 18)) * (coin.price ?? 0) <= p.tvlUsd * 20);
            raw = plausible.length ? plausible.reduce((m, r) => (r > m ? r : m), 0n) : null;
          }
        }
      }
      // Unmeasured (another DEX's V4 contracts, a vault holding the tokens, a failed read): small pools stay, a large
      // claim on one unpriced token does not, since real pools that size have both tokens priced.
      if (raw == null) { if (p.tvlUsd > UNMEASURED_MAX_USD) drop.add(p); continue; }
      const backedUsd = (Number(raw) / 10 ** decimals) * (coin.price ?? 0);
      if (2 * backedUsd < p.tvlUsd * MIN_BACKED_SHARE) drop.add(p);
      // A V4 reading is the active liquidity's reserve at the current price, which overstates a narrow range by
      // far (a fake BTC/USDB read as $500B of USDB). It can show a claim is empty, never that a large one is real.
      else if (!isAddress(p.id) && p.tvlUsd > UNMEASURED_MAX_USD) drop.add(p);
    }
  }

  const checked = new Set(due);
  return pools.filter((p) => !drop.has(p)).map((p) => (checked.has(p) ? { ...p, tvlChecked: true } : p));
}
