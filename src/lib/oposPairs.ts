/**
 * Every OPOS Uniswap V2 pair, what it holds and what it has earned. Pure reads.
 *
 * Valuation needs no token prices: a V2 pool always holds equal value on both
 * sides at its own price, so a pair is worth twice its OPOS side, and OPOS is
 * 1e6 per BTB. Fees: a V2 pool's sqrt(reserve0 * reserve1) per LP token only
 * grows from the 0.3% swap fee (the OPOS tax is taken outside the pool), and it
 * starts at 1 because the first mint issues sqrt(x * y) LP. So the share of a
 * pool's value that is fees is 1 - totalSupply / sqrt(k).
 */
import { erc20Abi, formatUnits, hexToString, parseAbi, type Address, type PublicClient } from 'viem';
import { withSafeMulticall } from './safeMulticall';
import {
  TOKENS, OTHER_PAIRED, OPOS, WETH, V2_FACTORY, FACTORY_ABI, BTB_V4_POOLS, V4_STATE_VIEW, STATE_VIEW_ABI,
  LP_RECIPIENT, sqrtToPrice, v3PriceUsd,
} from './oposSeed';

const PAIR_ABI = parseAbi([
  'function getReserves() view returns (uint112,uint112,uint32)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function factory() view returns (address)',
  'function totalSupply() view returns (uint256)',
]);
const SYMBOL32_ABI = parseAbi(['function symbol() view returns (bytes32)']);
const DEAD: Address = '0x000000000000000000000000000000000000dEaD';
const ZERO: Address = '0x0000000000000000000000000000000000000000';

export interface OposPair {
  symbol: string;
  token: Address;
  pair: Address;
  /** Uniswap V2, SushiSwap, or another V2 fork. */
  dex: string;
  /** False for a pair found only through the holder scan (token not in TOKENS or OTHER_PAIRED). */
  listed: boolean;
  /** OPOS side, in BTB (OPOS / 1e6). The whole pool is worth twice this. */
  btbSide: number;
  /** Fees earned by the whole pool since it opened, in BTB. */
  feesBtb: number;
  /** Shares of the LP supply. */
  safe: number;
  burned: number;
  other: number;
}

export interface OposPairsSummary {
  btbUsd: number;
  pairs: OposPair[];
  /** Contracts holding OPOS that are not V2 style pairs (bots, routers, other pool types). */
  unknownHolders: number;
}

function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n, y = (x + 1n) >> 1n;
  while (y < x) { x = y; y = (x + n / x) >> 1n; }
  return x;
}

/** BTB in USD: the mean of its Uniswap V4 BTB/USDC and BTB/ETH pools. */
export async function btbPriceUsd(client: PublicClient): Promise<number> {
  const wethUsd = await v3PriceUsd(client, WETH, 'USDC', 0, 18);
  const slots = await withSafeMulticall(client).multicall({ contracts: BTB_V4_POOLS.map((id) => ({ address: V4_STATE_VIEW, abi: STATE_VIEW_ABI, functionName: 'getSlot0' as const, args: [id] as const })), allowFailure: true });
  const prices: number[] = [];
  if (slots[0].status === 'success') prices.push(sqrtToPrice((slots[0].result as readonly [bigint, number, number, number])[0], 18, 6));
  if (slots[1].status === 'success') prices.push(wethUsd / sqrtToPrice((slots[1].result as readonly [bigint, number, number, number])[0], 18, 18));
  if (prices.length === 0) throw new Error('could not read the BTB pools');
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

/** OPOS holders that are contracts, from Blockscout's index. Empty if it is unreachable. */
async function oposHolderContracts(): Promise<Address[]> {
  const base = `https://eth.blockscout.com/api/v2/tokens/${OPOS}/holders`;
  const out: Address[] = [];
  try {
    let url = base;
    for (let page = 0; page < 40; page++) {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) break;
      const j = (await res.json()) as { items: { address: { hash: Address; is_contract: boolean } }[]; next_page_params: Record<string, string | number> | null };
      for (const h of j.items) if (h.address.is_contract) out.push(h.address.hash);
      if (!j.next_page_params) break;
      url = `${base}?${new URLSearchParams(Object.entries(j.next_page_params).map(([k, v]) => [k, String(v)]))}`;
    }
  } catch { /* fall back to the known token list alone */ }
  return out;
}

const DEX_NAMES: Record<string, string> = {
  [V2_FACTORY.toLowerCase()]: 'Uniswap V2',
  '0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac': 'SushiSwap',
  '0x1097053fd2ea711dad45caccc45eff7548fcb362': 'PancakeSwap V2',
};

/**
 * Every OPOS pair: the known tokens' Uniswap V2 pairs, plus any contract that
 * holds OPOS and behaves like a V2 pair (any token, any V2 fork), so a pool
 * opened outside the seed list still shows.
 */
export async function readOposPairs(client: PublicClient): Promise<OposPairsSummary> {
  const mc = withSafeMulticall(client);
  const seen = new Set<string>();
  const tokens = [...TOKENS, ...OTHER_PAIRED].filter((t) => !seen.has(t.address.toLowerCase()) && seen.add(t.address.toLowerCase()));
  const knownSymbol = new Map(tokens.map((t) => [t.address.toLowerCase(), t.symbol]));

  const [found, btbUsd, holders] = await Promise.all([
    mc.multicall({ contracts: tokens.map((t) => ({ address: V2_FACTORY, abi: FACTORY_ABI, functionName: 'getPair' as const, args: [OPOS, t.address] as const })), allowFailure: true }),
    btbPriceUsd(client),
    oposHolderContracts(),
  ]);
  const candidates = new Set<string>();
  found.forEach((f) => { if (f.status === 'success' && f.result !== ZERO) candidates.add((f.result as string).toLowerCase()); });
  holders.forEach((h) => candidates.add(h.toLowerCase()));
  const list = [...candidates] as Address[];

  const per = 8;
  const reads = await mc.multicall({
    contracts: list.flatMap((a) => [
      { address: a, abi: PAIR_ABI, functionName: 'getReserves' as const },
      { address: a, abi: PAIR_ABI, functionName: 'token0' as const },
      { address: a, abi: PAIR_ABI, functionName: 'token1' as const },
      { address: a, abi: PAIR_ABI, functionName: 'factory' as const },
      { address: a, abi: PAIR_ABI, functionName: 'totalSupply' as const },
      { address: a, abi: erc20Abi, functionName: 'balanceOf' as const, args: [LP_RECIPIENT] as const },
      { address: a, abi: erc20Abi, functionName: 'balanceOf' as const, args: [DEAD] as const },
      { address: a, abi: erc20Abi, functionName: 'balanceOf' as const, args: [ZERO] as const },
    ]),
    allowFailure: true,
  });

  const raw: { pair: Address; token: Address; dex: string; r0: bigint; r1: bigint; oposFirst: boolean; ts: bigint; safe: bigint; burned: bigint }[] = [];
  let unknownHolders = 0;
  list.forEach((a, i) => {
    const r = reads.slice(i * per, i * per + per);
    if (r.slice(0, 5).some((x) => x.status !== 'success')) { unknownHolders++; return; }
    const t0 = (r[1].result as string).toLowerCase(), t1 = (r[2].result as string).toLowerCase();
    const o = OPOS.toLowerCase();
    if (t0 !== o && t1 !== o) { unknownHolders++; return; }
    const [r0, r1] = r[0].result as readonly [bigint, bigint, number];
    const ts = r[4].result as bigint;
    if (ts === 0n || r0 === 0n || r1 === 0n) return; // created, never funded
    const factory = (r[3].result as string).toLowerCase();
    const get = (x: (typeof r)[number]) => (x.status === 'success' ? (x.result as bigint) : 0n);
    raw.push({ pair: a, token: (t0 === o ? r[2].result : r[1].result) as Address, dex: DEX_NAMES[factory] ?? 'V2 fork', r0, r1, oposFirst: t0 === o, ts, safe: get(r[5]), burned: get(r[6]) + get(r[7]) });
  });

  // Symbols for tokens outside the lists (string, or bytes32 like MKR).
  const unknown = [...new Set(raw.map((x) => x.token.toLowerCase()).filter((t) => !knownSymbol.has(t)))] as Address[];
  if (unknown.length) {
    const [str, b32] = await Promise.all([
      mc.multicall({ contracts: unknown.map((t) => ({ address: t, abi: erc20Abi, functionName: 'symbol' as const })), allowFailure: true }),
      mc.multicall({ contracts: unknown.map((t) => ({ address: t, abi: SYMBOL32_ABI, functionName: 'symbol' as const })), allowFailure: true }),
    ]);
    unknown.forEach((t, i) => {
      const s = str[i].status === 'success' ? (str[i].result as string)
        : b32[i].status === 'success' ? hexToString(b32[i].result as `0x${string}`, { size: 32 }).replace(/\0+$/, '') : `${t.slice(0, 6)}…`;
      knownSymbol.set(t.toLowerCase(), s);
    });
  }

  const share = (b: bigint, ts: bigint) => Number((b * 1_000_000n) / ts) / 1_000_000;
  const pairs: OposPair[] = raw.map((x) => {
    const btbSide = Number(formatUnits(x.oposFirst ? x.r0 : x.r1, 18)) / 1_000_000;
    const k = isqrt(x.r0 * x.r1);
    const feeShare = k > x.ts ? Number(k - x.ts) / Number(k) : 0;
    const safe = share(x.safe, x.ts), burned = share(x.burned, x.ts);
    return {
      symbol: knownSymbol.get(x.token.toLowerCase()) ?? x.token, token: x.token, pair: x.pair, dex: x.dex,
      listed: knownSymbol.has(x.token.toLowerCase()) && tokens.some((t) => t.address.toLowerCase() === x.token.toLowerCase()),
      btbSide, feesBtb: 2 * btbSide * feeShare, safe, burned, other: Math.max(0, 1 - safe - burned),
    };
  });
  pairs.sort((a, b) => b.btbSide - a.btbSide);
  return { btbUsd, pairs, unknownHolders };
}

/**
 * LP fees over the last ~24 h (7200 blocks): each pair's sqrt(k) per LP token
 * now against then. Needs an RPC that serves old state; null when none did.
 */
export async function readFees24h(client: PublicClient, pairs: OposPair[]): Promise<{ total: number; safe: number; byPair: Record<string, number> } | null> {
  try {
    const mc = withSafeMulticall(client);
    const then = (await client.getBlockNumber()) - 7200n;
    const calls = pairs.flatMap((p) => [
      { address: p.pair, abi: PAIR_ABI, functionName: 'getReserves' as const },
      { address: p.pair, abi: PAIR_ABI, functionName: 'totalSupply' as const },
    ]);
    const [old, cur] = await Promise.all([
      mc.multicall({ contracts: calls, allowFailure: true, blockNumber: then }),
      mc.multicall({ contracts: calls, allowFailure: true }),
    ]);
    const perLp = (res: typeof old, i: number) => {
      const r = res[i * 2], ts = res[i * 2 + 1];
      if (r.status !== 'success' || ts.status !== 'success' || (ts.result as bigint) === 0n) return null;
      const [r0, r1] = r.result as readonly [bigint, bigint, number];
      return Number(isqrt(r0 * r1)) / Number(ts.result as bigint);
    };
    let total = 0, safe = 0, seen = 0;
    const byPair: Record<string, number> = {};
    pairs.forEach((p, i) => {
      const a = perLp(old, i), b = perLp(cur, i);
      if (a == null || b == null) return; // pair younger than a day
      seen++;
      const f = b > a ? 2 * p.btbSide * (1 - a / b) : 0;
      byPair[p.pair] = f; total += f; safe += f * p.safe;
    });
    return seen > 0 ? { total, safe, byPair } : null;
  } catch { return null; }
}

/** OPOS treasury: where the 1% transfer tax lands. */
export const OPOS_TREASURY: Address = '0x1Ee9d27A62427a4a1c88518E34d04AAdD52a2C7a';
/** Our own wallets: the tax they paid (seeding as a non-treasury sender) is not income. */
const OWN_WALLETS = new Set(['0xa6a1f137d07be21a0bf4d15b11d295a09df04d22']);

export interface OposTax { day: number; week: number; all: number; since: number | null; ownPaid: number }

/**
 * Tax received by the treasury, in BTB, from Blockscout's indexed transfers.
 * Public RPC log queries were found to silently drop ranges, so they are not used.
 */
export async function readOposTax(): Promise<OposTax> {
  const base = `https://eth.blockscout.com/api/v2/addresses/${OPOS_TREASURY}/token-transfers?type=ERC-20&filter=to&token=${OPOS}`;
  const now = Date.now();
  const out: OposTax = { day: 0, week: 0, all: 0, since: null, ownPaid: 0 };
  let url = base;
  for (let page = 0; page < 200; page++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Blockscout ${res.status}`);
    const j = (await res.json()) as { items: { from: { hash: string }; total: { value: string }; timestamp: string }[]; next_page_params: Record<string, string | number> | null };
    for (const t of j.items) {
      const btbAmt = Number(BigInt(t.total.value) / 10n ** 12n) / 1e12; // OPOS (18 dec) / 1e6 per BTB
      if (OWN_WALLETS.has(t.from.hash.toLowerCase())) { out.ownPaid += btbAmt; continue; }
      const ts = Date.parse(t.timestamp), age = now - ts;
      out.all += btbAmt;
      if (age <= 86_400_000) out.day += btbAmt;
      if (age <= 7 * 86_400_000) out.week += btbAmt;
      out.since = out.since == null ? ts : Math.min(out.since, ts);
    }
    if (!j.next_page_params) break;
    url = `${base}&${new URLSearchParams(Object.entries(j.next_page_params).map(([k, v]) => [k, String(v)]))}`;
  }
  return out;
}
