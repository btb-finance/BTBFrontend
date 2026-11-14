/**
 * Measured ±5% range APR: what a concentrated position really earned, read
 * from the pool's own fee accounting instead of estimated from volume.
 *
 * Every concentrated pool keeps `feeGrowthInside(lower, upper)`: the fees one
 * unit of liquidity in that range has earned so far. A daily job
 * (convex/rangeYieldActions.ts) opens a ±5% band around the current price on
 * each pool and records that counter; the next day's run reads it again. The
 * difference is exactly what a ±5% position opened then and left alone has
 * earned: it stops growing while the price is outside the band, and it is
 * shared with whatever liquidity really sat at each traded tick. No volume,
 * TVL or USD price goes in.
 *
 * Works on Uniswap V3 and its forks (PancakeSwap, SushiSwap and the like),
 * Aerodrome/Velodrome Slipstream (a different `ticks()` layout, told apart by
 * the size of the answer) and Uniswap V4 through StateView. Algebra pools
 * keep fees another way and are skipped.
 *
 * A band edge must be an initialized tick: an uninitialized tick has no fee
 * record, so the counter is meaningless there. Each edge is therefore the
 * initialized tick nearest to -5% / +5% within 3.5% to 7%; a pool with no
 * liquidity edges in that window is not measured.
 */
import { decodeAbiParameters, encodeFunctionData, parseAbi, type PublicClient } from 'viem';

export const RANGE_YIELD_PCT = 5;

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;
const MC_ABI = parseAbi([
  'struct Call3 { address target; bool allowFailure; bytes callData; }',
  'struct Result { bool success; bytes returnData; }',
  'function aggregate3(Call3[] calls) payable returns (Result[] returnData)',
]);
const V3_ABI = parseAbi([
  'function slot0() view returns (uint160)',
  'function tickSpacing() view returns (int24)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)',
  'function tickBitmap(int16) view returns (uint256)',
  'function ticks(int24) view returns (uint128)',
  'function snapshotCumulativesInside(int24, int24) view returns (int56, uint160, uint32)',
  'function unstakedFee() view returns (uint24)',
]);
const V4_ABI = parseAbi([
  'function getSlot0(bytes32) view returns (uint160, int24, uint24, uint24)',
  'function getTickBitmap(bytes32, int16) view returns (uint256)',
  'function getTickInfo(bytes32, int24) view returns (uint128, int128, uint256, uint256)',
  'function getFeeGrowthInside(bytes32, int24, int24) view returns (uint256, uint256)',
  'function poolKeys(bytes25) view returns (address, address, uint24, int24, address)',
]);

const Q128 = 2 ** 128;
const MOD256 = 1n << 256n;
const LOG_BASE = Math.log(1.0001);
const MAX_TICK = 887272;
/** Bitmap words searched past ±7% for a band edge before falling back to full range. */
const FAR_WORDS = 6;
const tickOf = (ratio: number) => Math.log(ratio) / LOG_BASE;

export type PoolKind = 'v3' | 'slip' | 'v4';

/** One pool to measure. V4 pools are addressed by pool id through the chain's StateView. */
export interface YieldPool {
  id: string;
  v4?: { stateView: `0x${string}`; positionManager: `0x${string}` };
  /** Tick spacing found on an earlier run (fixed for a pool's life). */
  tickSpacing?: number;
  /** LP fee in hundredths of a bip, a hint for the V4 spacing search. */
  feeTier?: number;
}

export interface PoolNow {
  tick: number;
  /** sqrt(token1 raw per token0 raw). */
  sqrtP: number;
  /** 0 for a V4 pool whose spacing is not known yet: see findV4Spacing. */
  tickSpacing: number;
  /** Share of swap fees the LP keeps after the DEX's own cut, 0..1 (see lpShareOf). */
  lpShare?: number;
}

/**
 * Share of swap fees an LP keeps, from the pool's own settings. Forks store
 * the protocol cut in slot0's sixth word, each its own way:
 *  - Uniswap V3 and Sushi: a byte, one nibble per token, the cut is 1/n
 *    (0x44 = a quarter, 0x66 = a sixth, 0 = no cut).
 *  - PancakeSwap V3 and Giga: two 16 bit halves, each the cut per 10,000
 *    (3300 = 33%).
 *  - Ramses V3: one number, the cut per 1,000,000.
 * Slipstream has no cut in slot0; an unstaked LP gives up `unstakedFee` per
 * 1,000,000. Uniswap V4 charges its protocol fee on top of the LP fee, so its
 * LP fee rate is already what the LP keeps.
 */
export function lpShareOf(slot0Words: bigint[], unstakedFee: bigint | null): number | undefined {
  if (slot0Words.length === 6) return unstakedFee != null && unstakedFee <= 1_000_000n ? 1 - Number(unstakedFee) / 1e6 : undefined;
  if (slot0Words.length < 7) return undefined;
  const fp = Number(slot0Words[5]);
  if (fp === 0) return 1;
  if (fp < 256) {
    const cut = (n: number) => (n === 0 ? 0 : 1 / n);
    return 1 - (cut(fp % 16) + cut(fp >> 4)) / 2;
  }
  const lo = fp % 65536, hi = Math.floor(fp / 65536);
  if (lo <= 10_000 && hi <= 10_000) return 1 - (lo + hi) / 2 / 10_000;
  if (fp <= 1_000_000) return 1 - fp / 1_000_000;
  return undefined;
}

/** One open band: the fee counters inside it when it was opened. */
export interface Band {
  /** Opened at, ms. */
  t: number;
  lo: number;
  hi: number;
  /** feeGrowthInside0/1 X128 at open, decimal strings. */
  f0: string;
  f1: string;
  /** sqrt price at open. */
  sp: number;
  /** secondsInside at open (V3-style pools only): gives the share of time in range. */
  s?: number;
}

export interface InsideNow {
  f0: bigint;
  f1: bigint;
  /** Both edge ticks still hold liquidity, so the counter is still continuous. */
  ok: boolean;
  s?: number;
  kind: PoolKind;
}

export interface Measured {
  /** Fees earned, annualized, % of the deposit. */
  feeApr: number;
  /** Fees plus the price effect against simply holding the deposit, over the
   *  window (not annualized: a week's price move annualized means nothing). */
  netPct: number;
  days: number;
  /** Share of the window the price spent inside the band, % (V3-style pools only). */
  inRangePct?: number;
  /** Measured on a wider band (the pool has no liquidity edges near ±5%) and
   *  scaled to ±5%: assumes the price stayed within ±5%. */
  scaled: boolean;
  /** Actual band edges as % from the price at open. */
  lowPct: number;
  highPct: number;
}

export type Call = { target: `0x${string}`; callData: `0x${string}` };
export type Ret = `0x${string}` | null;

/** Raw Multicall3 reads, chunked and retried. Answers are raw bytes so the
 *  caller can tell fork layouts apart by size. */
export async function multiRaw(client: PublicClient, calls: Call[], chunk = 200): Promise<Ret[]> {
  const out: Ret[] = new Array(calls.length).fill(null);
  const chunks: number[] = [];
  for (let i = 0; i < calls.length; i += chunk) chunks.push(i);
  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const start = chunks[next++];
      const slice = calls.slice(start, start + chunk);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await client.readContract({
            address: MULTICALL3, abi: MC_ABI, functionName: 'aggregate3',
            args: [slice.map((c) => ({ target: c.target, allowFailure: true, callData: c.callData }))],
          }) as readonly { success: boolean; returnData: `0x${string}` }[];
          res.forEach((r, j) => { out[start + j] = r.success && r.returnData.length > 2 ? r.returnData : null; });
          break;
        } catch {
          if (attempt === 2) break;
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return out;
}

export const words = (hex: `0x${string}`) => {
  const body = hex.slice(2);
  const n = Math.floor(body.length / 64);
  return Array.from({ length: n }, (_, i) => BigInt('0x' + body.slice(i * 64, i * 64 + 64)));
};
const signed = (w: bigint) => Number(BigInt.asIntN(256, w));
const isV4 = (p: YieldPool) => !!p.v4;
const addr = (p: YieldPool) => p.id as `0x${string}`;
const pid = (p: YieldPool) => p.id as `0x${string}`;

/** Current tick, price and tick spacing of each pool; null where it cannot be read. */
export async function readPoolsNow(client: PublicClient, pools: YieldPool[]): Promise<(PoolNow | null)[]> {
  const calls: Call[] = pools.flatMap((p): Call[] => isV4(p)
    ? [
        { target: p.v4!.stateView, callData: encodeFunctionData({ abi: V4_ABI, functionName: 'getSlot0', args: [pid(p)] }) },
        { target: p.v4!.positionManager, callData: encodeFunctionData({ abi: V4_ABI, functionName: 'poolKeys', args: [p.id.slice(0, 52) as `0x${string}`] }) },
      ]
    : [
        { target: addr(p), callData: encodeFunctionData({ abi: V3_ABI, functionName: 'slot0' }) },
        { target: addr(p), callData: encodeFunctionData({ abi: V3_ABI, functionName: 'tickSpacing' }) },
      ]);
  // Slipstream's unstaked LP fee, asked of every V3-style pool (the others revert).
  const v3 = pools.map((p, i) => ({ p, i })).filter(({ p }) => !isV4(p));
  const [res, unstaked] = await Promise.all([
    multiRaw(client, calls),
    multiRaw(client, v3.map(({ p }) => ({ target: addr(p), callData: encodeFunctionData({ abi: V3_ABI, functionName: 'unstakedFee' }) }))),
  ]);
  const unstakedOf = new Map(v3.map(({ i }, j) => [i, unstaked[j] ? words(unstaked[j]!)[0] ?? null : null]));
  return pools.map((p, i) => {
    const s = res[i * 2], k = res[i * 2 + 1];
    if (!s || !k) return null;
    const sw = words(s), kw = words(k);
    if (sw.length < 2) return null;
    const sqrtP = Number(sw[0]) / 2 ** 96;
    const tick = signed(sw[1]);
    const read = isV4(p) ? (kw.length >= 5 ? signed(kw[3]) : 0) : (kw.length >= 1 ? signed(kw[0]) : 0);
    const tickSpacing = read > 0 && read <= 20_000 ? read : p.tickSpacing ?? 0;
    if (!(sqrtP > 0) || (!isV4(p) && !(tickSpacing > 0))) return null;
    const lpShare = isV4(p) ? 1 : lpShareOf(sw, unstakedOf.get(i) ?? null);
    return { tick, sqrtP, tickSpacing, ...(lpShare != null ? { lpShare } : {}) };
  });
}

/**
 * Tick spacing of V4 pools the PositionManager has never seen (pools created
 * straight on the PoolManager, common on Base), where StateView has no way to
 * say it. Each candidate spacing is tried against the pool's tick bitmap: a
 * candidate is right when the ticks its bitmap word decodes to really hold
 * liquidity. A wrong spacing decodes to ticks that hold none.
 */
export async function findV4Spacing(client: PublicClient, pools: YieldPool[], now: (PoolNow | null)[]): Promise<void> {
  const todo = pools.map((p, i) => ({ p, i })).filter(({ p, i }) => isV4(p) && now[i] && now[i]!.tickSpacing === 0);
  if (todo.length === 0) return;
  const BASE = [1, 2, 5, 10, 20, 25, 30, 40, 50, 60, 64, 80, 100, 120, 128, 150, 160, 180, 200, 240, 250, 256, 300, 400, 500, 600, 1000, 2000];
  const candidates = (p: YieldPool) => {
    const f = p.feeTier ?? 0;
    const hinted = [f / 100, f / 50, f / 200, f / 20].filter((x) => Number.isInteger(x) && x > 0 && x <= 20_000);
    return [...new Set([...hinted, ...BASE])];
  };
  const reqs = todo.flatMap(({ p, i }) => candidates(p).map((s) => ({ p, i, s, word: Math.floor(now[i]!.tick / s) >> 8 })));
  const bitmaps = await multiRaw(client, reqs.map(({ p, word }) => ({
    target: p.v4!.stateView, callData: encodeFunctionData({ abi: V4_ABI, functionName: 'getTickBitmap', args: [pid(p), word] }),
  })), 300);
  // Up to three set bits per candidate word, nearest the current tick first.
  const checks: { r: number; tick: number }[] = [];
  reqs.forEach(({ i, s, word }, r) => {
    const bits = bitmaps[r] ? words(bitmaps[r]!)[0] ?? 0n : 0n;
    if (bits === 0n) return;
    const set: number[] = [];
    for (let b = 0; b < 256; b++) if ((bits >> BigInt(b)) & 1n) set.push((word * 256 + b) * s);
    set.sort((a, b) => Math.abs(a - now[i]!.tick) - Math.abs(b - now[i]!.tick));
    for (const tick of set.slice(0, 3)) checks.push({ r, tick });
  });
  const infos = await multiRaw(client, checks.map(({ r, tick }) => ({
    target: reqs[r].p.v4!.stateView, callData: encodeFunctionData({ abi: V4_ABI, functionName: 'getTickInfo', args: [pid(reqs[r].p), tick] }),
  })), 300);
  const verdict = new Map<number, boolean>();
  checks.forEach(({ r }, j) => {
    const live = !!infos[j] && (words(infos[j]!)[0] ?? 0n) > 0n;
    verdict.set(r, (verdict.get(r) ?? true) && live);
  });
  const left: typeof todo = [];
  for (const { p, i } of todo) {
    // First candidate (fee-hinted ones lead) whose decoded ticks all hold
    // liquidity. A wrong spacing decodes the stored bits to ticks nobody uses.
    const hit = reqs.findIndex((q, r) => q.p === p && verdict.get(r) === true);
    if (hit >= 0) now[i] = { ...now[i]!, tickSpacing: reqs[hit].s };
    else left.push({ p, i });
  }
  // Nothing initialized near the price: the pool is likely full range only.
  // Its lowest usable tick is a multiple of the spacing, so the candidate
  // whose full-range edge holds liquidity is the spacing.
  const edge = left.flatMap(({ p, i }) => candidates(p).map((s) => ({ p, i, s })));
  const edgeInfo = await multiRaw(client, edge.map(({ p, s }) => ({
    target: p.v4!.stateView, callData: encodeFunctionData({ abi: V4_ABI, functionName: 'getTickInfo', args: [pid(p), Math.ceil(-MAX_TICK / s) * s] }),
  })), 300);
  for (const { p, i } of left) {
    const hit = edge.findIndex((q, j) => q.p === p && !!edgeInfo[j] && (words(edgeInfo[j]!)[0] ?? 0n) > 0n);
    if (hit >= 0) now[i] = { ...now[i]!, tickSpacing: edge[hit].s };
  }
}

/**
 * Edges for a new band. Preferred: the initialized ticks nearest to -5% and
 * +5%, each within 3.5% to 7% of the price, which measures a ±5% position
 * directly. A side with no liquidity edge there (common in pools where
 * everyone sits full range) falls back to the nearest edge further out, then
 * to the pool's full range; `measure` then scales that wider band to ±5%.
 * Null when the pool cannot be read.
 */
export async function pickBands(client: PublicClient, pools: YieldPool[], now: (PoolNow | null)[]): Promise<({ lo: number; hi: number } | null)[]> {
  const wordOf = (t: number, s: number) => Math.floor(t / s) >> 8;
  const windows = pools.map((_, i) => {
    const n = now[i];
    if (!n || !(n.tickSpacing > 0)) return null;
    return {
      lo: [Math.ceil(n.tick + tickOf(0.93)), Math.floor(n.tick + tickOf(0.965))] as const,
      hi: [Math.ceil(n.tick + tickOf(1.035)), Math.floor(n.tick + tickOf(1.07))] as const,
      loTarget: n.tick + tickOf(1 - RANGE_YIELD_PCT / 100),
      hiTarget: n.tick + tickOf(1 + RANGE_YIELD_PCT / 100),
    };
  });
  const ticks = new Map<number, number[]>();
  const read = async (reqs: { pool: number; word: number }[]) => {
    const res = await multiRaw(client, reqs.map(({ pool, word }) => {
      const p = pools[pool];
      return isV4(p)
        ? { target: p.v4!.stateView, callData: encodeFunctionData({ abi: V4_ABI, functionName: 'getTickBitmap', args: [pid(p), word] }) }
        : { target: addr(p), callData: encodeFunctionData({ abi: V3_ABI, functionName: 'tickBitmap', args: [word] }) };
    }), 300);
    reqs.forEach(({ pool, word }, j) => {
      const bits = res[j] ? words(res[j]!)[0] ?? 0n : 0n;
      if (bits === 0n) return;
      const s = now[pool]!.tickSpacing;
      const list = ticks.get(pool) ?? [];
      for (let b = 0; b < 256; b++) if ((bits >> BigInt(b)) & 1n) list.push((word * 256 + b) * s);
      ticks.set(pool, list);
    });
  };
  // Round 1: the words that cover -7%..+7%.
  const near: { pool: number; word: number }[] = [];
  const span = new Map<number, [number, number]>();
  windows.forEach((w, i) => {
    if (!w) return;
    const s = now[i]!.tickSpacing;
    const a = wordOf(w.lo[0], s), b = wordOf(w.hi[1], s);
    if (b - a > 10) return;
    span.set(i, [a, b]);
    for (let x = a; x <= b; x++) near.push({ pool: i, word: x });
  });
  await read(near);
  const inWindow = (i: number, range: readonly [number, number]) => (ticks.get(i) ?? []).some((t) => t >= range[0] && t <= range[1]);
  // Round 2: a few more words outward on a side that has no edge yet.
  const far: { pool: number; word: number }[] = [];
  for (const [i, [a, b]] of span) {
    const w = windows[i]!;
    if (!inWindow(i, w.lo)) for (let x = a - 1; x >= a - FAR_WORDS; x--) far.push({ pool: i, word: x });
    if (!inWindow(i, w.hi)) for (let x = b + 1; x <= b + FAR_WORDS; x++) far.push({ pool: i, word: x });
  }
  await read(far);
  return pools.map((_, i) => {
    const w = windows[i];
    if (!w || !span.has(i)) return null;
    const s = now[i]!.tickSpacing;
    const list = ticks.get(i) ?? [];
    const nearest = (range: readonly [number, number], target: number) => {
      let best: number | null = null;
      for (const t of list) if (t >= range[0] && t <= range[1] && (best == null || Math.abs(t - target) < Math.abs(best - target))) best = t;
      return best;
    };
    const below = list.filter((t) => t < w.lo[0]);
    const above = list.filter((t) => t > w.hi[1]);
    const lo = nearest(w.lo, w.loTarget) ?? (below.length ? Math.max(...below) : Math.ceil(-MAX_TICK / s) * s);
    const hi = nearest(w.hi, w.hiTarget) ?? (above.length ? Math.min(...above) : Math.floor(MAX_TICK / s) * s);
    return lo < hi ? { lo, hi } : null;
  });
}

/** feeGrowthInside for each (pool, lo, hi) right now, plus seconds inside where the pool keeps it. */
export async function readInside(
  client: PublicClient,
  items: { pool: YieldPool; now: PoolNow; lo: number; hi: number }[],
  globals: Map<string, [bigint, bigint]>,
): Promise<(InsideNow | null)[]> {
  const calls: Call[] = items.flatMap(({ pool, lo, hi }): Call[] => isV4(pool)
    ? [
        { target: pool.v4!.stateView, callData: encodeFunctionData({ abi: V4_ABI, functionName: 'getFeeGrowthInside', args: [pid(pool), lo, hi] }) },
        { target: pool.v4!.stateView, callData: encodeFunctionData({ abi: V4_ABI, functionName: 'getTickInfo', args: [pid(pool), lo] }) },
        { target: pool.v4!.stateView, callData: encodeFunctionData({ abi: V4_ABI, functionName: 'getTickInfo', args: [pid(pool), hi] }) },
      ]
    : [
        { target: addr(pool), callData: encodeFunctionData({ abi: V3_ABI, functionName: 'snapshotCumulativesInside', args: [lo, hi] }) },
        { target: addr(pool), callData: encodeFunctionData({ abi: V3_ABI, functionName: 'ticks', args: [lo] }) },
        { target: addr(pool), callData: encodeFunctionData({ abi: V3_ABI, functionName: 'ticks', args: [hi] }) },
      ]);
  const res = await multiRaw(client, calls);
  return items.map(({ pool, now, lo, hi }, i) => {
    const a = res[i * 3], l = res[i * 3 + 1], u = res[i * 3 + 2];
    if (!l || !u) return null;
    const lw = words(l), uw = words(u);
    if (isV4(pool)) {
      if (!a || lw.length < 4 || uw.length < 4) return null;
      const [f0, f1] = decodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], a);
      return { f0, f1, ok: lw[0] > 0n && uw[0] > 0n, kind: 'v4' };
    }
    // Uniswap V3 ticks(): 8 words, fee growth at 2 and 3, initialized last.
    // Slipstream adds stakedLiquidityNet (fee growth at 3 and 4) and a reward
    // counter: 10 words. Anything else is a layout we do not know.
    const kind: PoolKind | null = lw.length === 8 && uw.length === 8 ? 'v3' : lw.length === 10 && uw.length === 10 ? 'slip' : null;
    const g = globals.get(pool.id.toLowerCase());
    if (!kind || !g) return null;
    const at = kind === 'v3' ? 2 : 3;
    const [g0, g1] = g;
    const inside = (outLo: bigint, outHi: bigint, global: bigint) => {
      const below = now.tick >= lo ? outLo : global - outLo;
      const above = now.tick < hi ? outHi : global - outHi;
      return (((global - below - above) % MOD256) + MOD256) % MOD256;
    };
    const ok = lw[0] > 0n && uw[0] > 0n && lw[lw.length - 1] === 1n && uw[uw.length - 1] === 1n;
    const s = a && words(a).length >= 3 ? Number(words(a)[2]) : undefined;
    return { f0: inside(lw[at], uw[at], g0), f1: inside(lw[at + 1], uw[at + 1], g1), ok, s, kind };
  });
}

/** Global fee counters of V3-style pools (V4 answers feeGrowthInside directly). */
export async function readGlobals(client: PublicClient, pools: YieldPool[]): Promise<Map<string, [bigint, bigint]>> {
  const v3 = pools.filter((p) => !isV4(p));
  const res = await multiRaw(client, v3.flatMap((p) => [
    { target: addr(p), callData: encodeFunctionData({ abi: V3_ABI, functionName: 'feeGrowthGlobal0X128' }) },
    { target: addr(p), callData: encodeFunctionData({ abi: V3_ABI, functionName: 'feeGrowthGlobal1X128' }) },
  ]));
  const out = new Map<string, [bigint, bigint]>();
  v3.forEach((p, i) => {
    const a = res[i * 2], b = res[i * 2 + 1];
    if (a && b) out.set(p.id.toLowerCase(), [words(a)[0], words(b)[0]]);
  });
  return out;
}

/** Token amounts (raw) held by one unit of liquidity in [sa, sb] at sqrt price s. */
function amountsPerL(s: number, sa: number, sb: number): [number, number] {
  if (s <= sa) return [1 / sa - 1 / sb, 0];
  if (s >= sb) return [0, sb - sa];
  return [1 / s - 1 / sb, s - sa];
}

/**
 * What the band earned between its opening and now. Everything is valued in
 * token1 at today's price, so neither USD prices nor token decimals are needed:
 * fees and the deposit are in the same units and the ratio is the yield.
 */
export function measure(band: Band, now: PoolNow, inside: InsideNow, atMs: number): Measured | null {
  const days = (atMs - band.t) / 86_400_000;
  if (!(days > 0.5) || !inside.ok) return null;
  const d0 = (((inside.f0 - BigInt(band.f0)) % MOD256) + MOD256) % MOD256;
  const d1 = (((inside.f1 - BigInt(band.f1)) % MOD256) + MOD256) % MOD256;
  // A counter that went backwards wraps to an enormous number: the tick was
  // cleared and re-created in between, so this band is no longer measurable.
  if (d0 > MOD256 >> 1n || d1 > MOD256 >> 1n) return null;
  const price = now.sqrtP * now.sqrtP;
  const priceAtOpen = band.sp * band.sp;
  const lowPct = (Math.pow(1.0001, band.lo) / priceAtOpen - 1) * 100;
  const highPct = (Math.pow(1.0001, band.hi) / priceAtOpen - 1) * 100;
  const scaled = !(lowPct >= -7.01 && lowPct <= -3.49 && highPct >= 3.49 && highPct <= 7.01);
  // The deposit per unit of liquidity: the measured band itself when its
  // edges are near ±5%, otherwise an exact ±5% band around the opening price.
  // The fees per unit of liquidity are the same for both while the price is
  // inside ±5%, which is what scaling a wider band down assumes.
  const sa = scaled ? band.sp * Math.sqrt(1 - RANGE_YIELD_PCT / 100) : Math.pow(1.0001, band.lo / 2);
  const sb = scaled ? band.sp * Math.sqrt(1 + RANGE_YIELD_PCT / 100) : Math.pow(1.0001, band.hi / 2);
  const [h0, h1] = amountsPerL(band.sp, sa, sb);
  const [p0, p1] = amountsPerL(now.sqrtP, sa, sb);
  const hold = h0 * price + h1;
  if (!(hold > 0)) return null;
  const fees = (Number(d0) / Q128) * price + Number(d1) / Q128;
  const feeApr = (fees / hold) * (365 / days) * 100;
  if (!Number.isFinite(feeApr) || feeApr < 0 || feeApr > 100_000) return null;
  // secondsInside is a uint32 that wraps; the difference is taken modulo 2^32.
  // It describes the measured band, so a scaled band has no in-range share.
  const inRangePct = !scaled && inside.s != null && band.s != null
    ? Math.min(100, ((((inside.s - band.s) % 2 ** 32) + 2 ** 32) % 2 ** 32 / ((atMs - band.t) / 1000)) * 100)
    : undefined;
  return {
    feeApr,
    netPct: ((fees + p0 * price + p1 - hold) / hold) * 100,
    days,
    inRangePct,
    scaled,
    lowPct,
    highPct,
  };
}
