/**
 * Smart LPs: the positions in a pool that stayed in range and beat simply
 * holding the tokens. Read from the chain, no indexer.
 *
 * 1. Find positions. Every V3-style position manager mint shows up on the pool
 *    as a `Mint` (owner = the manager) and on the manager as an
 *    `IncreaseLiquidity` (indexed token id) in the same transaction, so the
 *    two joined by transaction give each new position's token id. Logs come
 *    from Blockscout where our key covers the chain (no range limit) and from
 *    the chain's RPCs in block chunks elsewhere (Base, BNB).
 * 2. Measure. A position whose liquidity has not changed earned exactly
 *    L x (fee growth inside its range now, minus when we first saw it), however
 *    often its owner collected. The same pool counters give seconds in range,
 *    and the price then and now gives the result against holding. So one
 *    snapshot per position is enough: no deposit, withdrawal or collect
 *    history. A position whose liquidity changed starts a new window.
 *
 * Values are worked out in token1 at today's price, then turned into dollars
 * with one DeFiLlama price, only for display and the size filter.
 */
import { encodeFunctionData, parseAbi, type PublicClient } from 'viem';
import { multiRaw, words, readPoolsNow, readGlobals, readInside, type PoolNow, type YieldPool } from './rangeYield';
import { v3DeploymentFor, type LpDex } from '@/protocols/lpChains';
import { aerodromeDeploymentsFor } from '@/protocols/dexs/aerodrome';

const LP_DEXES: LpDex[] = ['uniswap', 'pancakeswap', 'aerodrome', 'aero', 'giga', 'ramses', 'up', 'sushiswap', 'alandale'];

/** Position managers the app knows on a chain. Pool Mints owned by anything else are bots and vaults, not NFT positions. */
export function positionManagersFor(chainId: number): string[] {
  const all = [
    ...LP_DEXES.map((d) => v3DeploymentFor(d, chainId)?.positionManager),
    ...aerodromeDeploymentsFor(chainId).map((d) => d.positionManager),
  ];
  return [...new Set(all.filter((a): a is `0x${string}` => !!a).map((a) => a.toLowerCase()))];
}

const MINT_T0 = '0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde';
const INC_T0 = '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f';
const BURN_T0 = '0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c';
/** Chains our Blockscout PRO key reads (Base needs a paid plan, BNB is not on Blockscout). */
const BLOCKSCOUT_CHAINS = new Set([1, 10, 42161, 4663, 5042, 57073]);
const NPM_ABI = parseAbi([
  'function positions(uint256) view returns (uint96)',
  'function ownerOf(uint256) view returns (address)',
]);
const POOL_ABI = parseAbi(['function token0() view returns (address)', 'function token1() view returns (address)']);
const ERC20_ABI = parseAbi(['function decimals() view returns (uint8)']);
const Q128 = 2 ** 128;
const MOD256 = 1n << 256n;

/** Shortest window shown as a result: fewer days says little. */
export const MIN_WINDOW_DAYS = 2.5;
/** What makes an LP "smart" here: mostly in range, big enough to matter. */
export const SMART_MIN_IN_RANGE = 70;
export const SMART_MIN_USD = 500;
/** Positions worth less than this are not tracked at all. */
const TRACK_MIN_USD = 100;

export interface RawLog { address: string; topics: string[]; data: string; block: number; logIndex: number; tx: string }

/** One tracked position: its range and the snapshot its window starts from. */
export interface Tracked {
  id: string;
  npm: string;
  pool: string;
  tl: number;
  tu: number;
  /** Liquidity at the snapshot (decimal string); a change starts a new window. */
  L: string;
  /** Snapshot time (ms), fee growth inside, seconds inside, sqrt price, tick. */
  t0: number;
  f0: string;
  f1: string;
  s0?: number;
  sp0: number;
  tick0: number;
  owner?: string;
}

/** What the page shows for one position. */
export interface SmartLp {
  id: string;
  owner?: string;
  /** Range edges as % from the price when the window started. */
  lowPct: number;
  highPct: number;
  /** Same edges in ticks from the tick then: "use this range" re-centres them. */
  dLo: number;
  dHi: number;
  days: number;
  inRangePct?: number;
  feeApr: number;
  /** Fees plus the price move against holding, over the window (%). */
  netPct: number;
  netApr: number;
  valueUsd?: number;
  nowInRange: boolean;
}

export interface PoolSmartLps { tracked: number; measured: number; smart: number; top: SmartLp[] }

// ── Logs ────────────────────────────────────────────────────────────────────

async function blockscoutLogs(chainId: number, apiKey: string, address: string, topic0: string, from: number, to: number): Promise<RawLog[]> {
  const out = new Map<string, RawLog>();
  // Big windows on quiet chains, smaller where blocks are dense, so one answer stays well inside a timeout.
  const span = 2_000_000;
  for (let start = from; start <= to; start += span) {
    let cursor = start;
    const end = Math.min(to, start + span - 1);
    while (cursor <= end) {
      const url = `https://api.blockscout.com/${chainId}/api?module=logs&action=getLogs&fromBlock=${cursor}&toBlock=${end}&address=${address}&topic0=${topic0}&apikey=${apiKey}`;
      type Row = { address: string; topics: (string | null)[]; data: string; blockNumber: string; logIndex: string; transactionHash: string };
      let rows: Row[] | null = null;
      for (let attempt = 0; attempt < 3 && rows == null; attempt++) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
          const json = await res.json() as { result?: unknown };
          rows = Array.isArray(json.result) ? json.result as Row[] : [];
        } catch {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
      if (rows == null) throw new Error(`blockscout logs ${chainId} ${address} ${cursor}`);
      for (const r of rows) {
        const log: RawLog = {
          address: r.address.toLowerCase(), topics: r.topics.filter((t): t is string => !!t), data: r.data,
          block: parseInt(r.blockNumber, 16), logIndex: parseInt(r.logIndex || '0x0', 16), tx: r.transactionHash.toLowerCase(),
        };
        out.set(`${log.tx}:${log.logIndex}`, log);
      }
      // A full page (1000) continues from its last block; the overlap is deduplicated above.
      if (rows.length < 1000) break;
      const last = parseInt(rows[rows.length - 1].blockNumber, 16);
      cursor = last > cursor ? last : cursor + 1;
    }
  }
  return [...out.values()];
}

/**
 * RPCs that answer eth_getLogs properly, per chain (tested 2026-11-13). Most public BNB RPCs cap the range at 100
 * blocks, rate limit, or answer HTML, and a fallback list then hands back an empty result that reads as "no logs":
 * the scan moved on having found nothing. Logs go only to these, in order; when none answers, the step fails and
 * the job keeps its place.
 */
type LogRpc = { url: string; /** Only for queries starting within this many blocks of the tip: older logs are pruned and come back as a silent empty answer. */ recentBlocks?: number; span: number };
const LOG_RPCS: Record<number, LogRpc[]> = {
  8453: [{ url: 'https://base.api.pocket.network', span: 10_000 }, { url: 'https://base-rpc.publicnode.com', span: 10_000 }],
  // BNB (2026-11-14): publicnode takes 50k blocks but keeps only about 2 days of logs; Pocket keeps about 5 days
  // in 5k-block queries. Recent ranges go to publicnode, older ones to Pocket.
  56: [{ url: 'https://bsc-rpc.publicnode.com', recentBlocks: 290_000, span: 50_000 }, { url: 'https://bsc.api.pocket.network', span: 5_000 }],
};
const headCache = new Map<number, { at: number; head: number }>();
async function headOf(client: PublicClient): Promise<number> {
  const id = client.chain?.id ?? 0;
  const hit = headCache.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit.head;
  const head = Number(await client.getBlockNumber());
  headCache.set(id, { at: Date.now(), head });
  return head;
}
/** The log RPCs that can serve a query starting at `fromBlock`, in order. */
async function logRpcsFor(client: PublicClient, fromBlock: number): Promise<LogRpc[] | null> {
  const list = LOG_RPCS[client.chain?.id ?? 0];
  if (!list) return null;
  const head = await headOf(client);
  return list.filter((r) => r.recentBlocks == null || head - fromBlock <= r.recentBlocks);
}

/** One JSON-RPC call through the chain's tested RPCs (LOG_RPCS), with retries; the client's own list elsewhere. */
async function rpcCall<T>(client: PublicClient, method: string, params: unknown[], ok: (r: unknown) => boolean, fromBlock?: number): Promise<T> {
  const rpcs = await logRpcsFor(client, fromBlock ?? Number.MAX_SAFE_INTEGER);
  if (!rpcs) return client.request({ method: method as never, params: params as never }) as Promise<T>;
  let last: unknown = null;
  for (const { url } of rpcs) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(45_000) });
        const json = await res.json() as { result?: unknown; error?: { message?: string } };
        if (ok(json.result)) return json.result as T;
        last = new Error(json.error?.message ?? 'no result');
        // A range or size limit is not fixed by retrying here: let the caller halve.
        if (/range|limit|too many|exceed|10000/i.test(json.error?.message ?? '')) break;
      } catch (e) { last = e; }
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw last instanceof Error ? last : new Error(`${method} failed`);
}

const getLogsRaw = (client: PublicClient, filter: Record<string, unknown> & { fromBlock: string }) =>
  rpcCall<unknown[]>(client, 'eth_getLogs', [filter], Array.isArray, parseInt(filter.fromBlock, 16));

async function rpcLogs(client: PublicClient, address: string | string[], topic0: string, from: number, to: number, topic1?: string[]): Promise<RawLog[]> {
  const out: RawLog[] = [];
  // The widest query the RPC serving this range takes.
  const maxSpan = (await logRpcsFor(client, from))?.[0]?.span ?? 10_000;
  let span = maxSpan;
  for (let start = from; start <= to;) {
    const end = Math.min(to, start + span - 1);
    try {
      const logs = await getLogsRaw(client, { address, topics: topic1 ? [topic0, topic1] : [topic0], fromBlock: `0x${start.toString(16)}`, toBlock: `0x${end.toString(16)}` }) as { address: string; topics: string[]; data: string; blockNumber: string; logIndex: string; transactionHash: string }[];
      for (const r of logs) out.push({ address: r.address.toLowerCase(), topics: r.topics, data: r.data, block: parseInt(r.blockNumber, 16), logIndex: parseInt(r.logIndex, 16), tx: r.transactionHash.toLowerCase() });
      start = end + 1;
      if (span < maxSpan) span = Math.min(maxSpan, span * 2);
    } catch (e) {
      // Range or result-size limits differ per RPC: halve and retry.
      if (span <= 1_000) throw e;
      span = Math.floor(span / 2);
    }
  }
  return out;
}

export const usesBlockscout = (chainId: number, apiKey?: string) => !!apiKey && BLOCKSCOUT_CHAINS.has(chainId);

export function fetchLogs(chainId: number, client: PublicClient, apiKey: string | undefined, address: string, topic0: string, from: number, to: number): Promise<RawLog[]> {
  return usesBlockscout(chainId, apiKey)
    ? blockscoutLogs(chainId, apiKey!, address, topic0, from, to)
    : rpcLogs(client, address, topic0, from, to);
}

/**
 * Positions opened (or added to) in [from, to] on these pools: the pool's
 * Mint joined to the position manager's IncreaseLiquidity in the same
 * transaction. Mints by vaults that hold liquidity directly have no manager
 * event and drop out.
 */
export async function discoverPositions(
  chainId: number, client: PublicClient, apiKey: string | undefined, pools: string[], from: number, to: number,
  /** RPC chains: Burns up to this block close Mints, so only positions still open by then need a receipt. */
  burnsTo?: number,
): Promise<{ id: string; npm: string; pool: string }[]> {
  const mints: RawLog[] = [];
  // RPCs take every pool in one query; Blockscout takes one address at a time.
  if (usesBlockscout(chainId, apiKey)) for (const pool of pools) for (const l of await fetchLogs(chainId, client, apiKey, pool, MINT_T0, from, to)) mints.push(l);
  else {
    // Owner filter: only Mints by the chain's position managers (a busy Base pool has thousands of bot Mints a day).
    // Public RPCs take at most 10 addresses per query.
    const owners = positionManagersFor(chainId).map((a) => `0x${a.slice(2).padStart(64, '0')}`);
    const topic1 = owners.length ? owners : undefined;
    const raw: RawLog[] = [];
    for (let i = 0; i < pools.length; i += 10) for (const l of await rpcLogs(client, pools.slice(i, i + 10), MINT_T0, from, to, topic1)) raw.push(l);
    // Bots open and close positions within hours: a Mint matched by a Burn of the same liquidity on the same
    // range (same manager) is already closed and never needs its receipt. Only the rest go on.
    const burned = new Map<string, number>();
    if (burnsTo != null && raw.length > 0) {
      for (let i = 0; i < pools.length; i += 10) {
        for (const b of await rpcLogs(client, pools.slice(i, i + 10), BURN_T0, from, burnsTo, topic1)) {
          const k = `${b.address}|${b.topics[1]}|${b.topics[2]}|${b.topics[3]}|${BigInt(b.data.slice(0, 66))}`;
          burned.set(k, (burned.get(k) ?? 0) + 1);
        }
      }
    }
    for (const m of raw) {
      const k = `${m.address}|${m.topics[1]}|${m.topics[2]}|${m.topics[3]}|${BigInt('0x' + m.data.slice(66, 130))}`;
      const n = burned.get(k) ?? 0;
      if (n > 0) burned.set(k, n - 1);
      else mints.push(m);
    }
  }
  if (process.env.SMART_LPS_DEBUG) console.log(`  mints ${mints.length} in ${from}..${to}`);
  const incByTx = new Map<string, RawLog[]>();
  const add = (l: RawLog) => { const list = incByTx.get(l.tx); if (list) list.push(l); else incByTx.set(l.tx, [l]); };
  if (usesBlockscout(chainId, apiKey)) {
    // Blockscout: the managers' IncreaseLiquidity logs over the same blocks. Only managers emit it, so an owner
    // that is a vault answers with nothing.
    const owners = [...new Set(mints.map((m) => `0x${m.topics[1]?.slice(26) ?? ''}`.toLowerCase()).filter((a) => a.length === 42))];
    for (const owner of owners) for (const l of await fetchLogs(chainId, client, apiKey, owner, INC_T0, from, to)) add(l);
  } else {
    // RPC chains: a manager like Base's emits IncreaseLiquidity for every pool on the chain, far too many to pull
    // by block range, so read the receipts of just these mints instead.
    const txs = [...new Set(mints.map((m) => m.tx))];
    let next = 0;
    let failedReceipts = 0;
    const worker = async () => {
      while (next < txs.length) {
        const hash = txs[next++];
        type Rlog = { address: string; topics: string[]; data: string; blockNumber: string; logIndex: string };
        const receipt = await rpcCall<{ logs: Rlog[] }>(client, 'eth_getTransactionReceipt', [hash], (r) => !!r && Array.isArray((r as { logs?: unknown }).logs)).catch(() => null);
        if (!receipt) { failedReceipts++; continue; }
        for (const l of receipt.logs) {
          if (l.topics[0] !== INC_T0) continue;
          add({ address: l.address.toLowerCase(), topics: l.topics, data: l.data, block: parseInt(l.blockNumber, 16), logIndex: parseInt(l.logIndex, 16), tx: hash });
        }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    // Missing receipts mean missing positions: fail the step (the job keeps its place) rather than skip them.
    if (failedReceipts > Math.max(3, txs.length * 0.05)) throw new Error(`${failedReceipts} of ${txs.length} receipts failed`);
  }
  const found = new Map<string, { id: string; npm: string; pool: string }>();
  for (const m of mints) {
    const owner = `0x${m.topics[1]?.slice(26) ?? ''}`.toLowerCase();
    const inc = (incByTx.get(m.tx) ?? []).filter((l) => l.address === owner && l.logIndex > m.logIndex).sort((a, b) => a.logIndex - b.logIndex)[0];
    if (!inc || !inc.topics[1]) continue;
    const id = BigInt(inc.topics[1]).toString();
    found.set(`${owner}:${id}`, { id, npm: owner, pool: m.address });
  }
  return [...found.values()];
}

// ── Measuring ───────────────────────────────────────────────────────────────

type PositionRead = { tl: number; tu: number; L: bigint; owner?: string } | null;

/** NPM.positions and ownerOf, decoded from raw words (Uniswap, PancakeSwap and Slipstream share the layout). */
export async function readPositions(client: PublicClient, list: { id: string; npm: string }[]): Promise<PositionRead[]> {
  const res = await multiRaw(client, list.flatMap(({ id, npm }) => [
    { target: npm as `0x${string}`, callData: encodeFunctionData({ abi: NPM_ABI, functionName: 'positions', args: [BigInt(id)] }) },
    { target: npm as `0x${string}`, callData: encodeFunctionData({ abi: NPM_ABI, functionName: 'ownerOf', args: [BigInt(id)] }) },
  ]));
  return list.map((_, i) => {
    const p = res[i * 2], o = res[i * 2 + 1];
    if (!p) return null;
    const w = words(p);
    if (w.length < 12) return null;
    const signed = (x: bigint) => Number(BigInt.asIntN(256, x));
    return { tl: signed(w[5]), tu: signed(w[6]), L: w[7], owner: o ? `0x${o.slice(-40)}`.toLowerCase() : undefined };
  });
}

/** Snapshot each item's fee counters through `client` (today or a past block). */
export async function snapshot(
  client: PublicClient, items: { id: string; npm: string; pool: string; tl: number; tu: number; L: bigint; owner?: string }[], at: number,
): Promise<(Tracked | null)[]> {
  const pools = [...new Set(items.map((x) => x.pool))].map((id) => ({ id }) as YieldPool);
  const now = await readPoolsNow(client, pools);
  const nowOf = new Map(pools.map((p, i) => [p.id, now[i]]));
  const globals = await readGlobals(client, pools);
  const live = items.map((x, i) => ({ x, i, n: nowOf.get(x.pool) })).filter((r) => r.n);
  const inside = await readInside(client, live.map(({ x, n }) => ({ pool: { id: x.pool }, now: n!, lo: x.tl, hi: x.tu })), globals);
  const out: (Tracked | null)[] = items.map(() => null);
  live.forEach(({ x, i, n }, j) => {
    const r = inside[j];
    if (!r || !r.ok) return;
    out[i] = { id: x.id, npm: x.npm, pool: x.pool, tl: x.tl, tu: x.tu, L: x.L.toString(), t0: at, f0: r.f0.toString(), f1: r.f1.toString(), ...(r.s != null ? { s0: r.s } : {}), sp0: n!.sqrtP, tick0: n!.tick, ...(x.owner ? { owner: x.owner } : {}) };
  });
  return out;
}

function amountsPerL(s: number, sa: number, sb: number): [number, number] {
  if (s <= sa) return [1 / sa - 1 / sb, 0];
  if (s >= sb) return [0, sb - sa];
  return [1 / s - 1 / sb, s - sa];
}

/** Token1 decimals and a token1 USD price per pool (via token0 and the pool price when only it is priced). */
export async function poolUsd(client: PublicClient, llamaChain: string, pools: string[], now: Map<string, PoolNow | null>): Promise<Map<string, { usdPerRaw1: number }>> {
  const tok = await multiRaw(client, pools.flatMap((p) => [
    { target: p as `0x${string}`, callData: encodeFunctionData({ abi: POOL_ABI, functionName: 'token0' }) },
    { target: p as `0x${string}`, callData: encodeFunctionData({ abi: POOL_ABI, functionName: 'token1' }) },
  ]));
  const t0 = pools.map((_, i) => (tok[i * 2] ? `0x${tok[i * 2]!.slice(-40)}`.toLowerCase() : null));
  const t1 = pools.map((_, i) => (tok[i * 2 + 1] ? `0x${tok[i * 2 + 1]!.slice(-40)}`.toLowerCase() : null));
  const tokens = [...new Set([...t0, ...t1].filter((t): t is string => !!t))];
  const dec = await multiRaw(client, tokens.map((t) => ({ target: t as `0x${string}`, callData: encodeFunctionData({ abi: ERC20_ABI, functionName: 'decimals' }) })));
  const decOf = new Map(tokens.map((t, i) => [t, dec[i] ? Number(words(dec[i]!)[0]) : null]));
  const prices: Record<string, number> = {};
  for (let i = 0; i < tokens.length; i += 80) {
    const keys = tokens.slice(i, i + 80).map((t) => `${llamaChain}:${t}`).join(',');
    const json = await fetch(`https://coins.llama.fi/prices/current/${keys}`, { signal: AbortSignal.timeout(30_000) }).then((r) => r.json()).catch(() => null) as { coins?: Record<string, { price?: number }> } | null;
    for (const [k, v] of Object.entries(json?.coins ?? {})) if (v.price && v.price > 0) prices[k.split(':')[1].toLowerCase()] = v.price;
  }
  const out = new Map<string, { usdPerRaw1: number }>();
  pools.forEach((p, i) => {
    const a = t0[i], b = t1[i], n = now.get(p);
    if (!a || !b || !n) return;
    const d0 = decOf.get(a), d1 = decOf.get(b);
    if (d0 == null || d1 == null) return;
    // USD per raw unit of token1, from token1's price, or from token0's through the pool price.
    if (prices[b]) out.set(p, { usdPerRaw1: prices[b] / 10 ** d1 });
    else if (prices[a]) out.set(p, { usdPerRaw1: prices[a] / 10 ** d0 / (n.sqrtP * n.sqrtP) });
  });
  return out;
}

/**
 * Result of one position over its window, or null when the window is too
 * short or the counters cannot be trusted (an edge tick was cleared).
 */
export function measurePosition(t: Tracked, now: PoolNow, inside: { f0: bigint; f1: bigint; s?: number; ok: boolean }, atMs: number, usdPerRaw1?: number): SmartLp | null {
  const days = (atMs - t.t0) / 86_400_000;
  if (!inside.ok || days < MIN_WINDOW_DAYS) return null;
  const d0 = (((inside.f0 - BigInt(t.f0)) % MOD256) + MOD256) % MOD256;
  const d1 = (((inside.f1 - BigInt(t.f1)) % MOD256) + MOD256) % MOD256;
  if (d0 > MOD256 >> 1n || d1 > MOD256 >> 1n) return null;
  const L = Number(t.L);
  const price = now.sqrtP * now.sqrtP;
  const sa = Math.pow(1.0001, t.tl / 2), sb = Math.pow(1.0001, t.tu / 2);
  const [h0, h1] = amountsPerL(t.sp0, sa, sb);
  const [p0, p1] = amountsPerL(now.sqrtP, sa, sb);
  const hold = (h0 * price + h1) * L;
  if (!(hold > 0)) return null;
  const value = (p0 * price + p1) * L;
  const fees = ((Number(d0) / Q128) * price + Number(d1) / Q128) * L;
  const feeApr = (fees / hold) * (365 / days) * 100;
  const netPct = ((value + fees - hold) / hold) * 100;
  if (!Number.isFinite(feeApr) || feeApr > 100_000) return null;
  const inRangePct = inside.s != null && t.s0 != null
    ? Math.min(100, (((inside.s - t.s0) % 2 ** 32) + 2 ** 32) % 2 ** 32 / ((atMs - t.t0) / 1000) * 100)
    : undefined;
  const price0 = t.sp0 * t.sp0;
  return {
    id: t.id,
    ...(t.owner ? { owner: t.owner } : {}),
    lowPct: (Math.pow(1.0001, t.tl) / price0 - 1) * 100,
    highPct: (Math.pow(1.0001, t.tu) / price0 - 1) * 100,
    dLo: t.tl - t.tick0,
    dHi: t.tu - t.tick0,
    days,
    ...(inRangePct != null ? { inRangePct } : {}),
    feeApr,
    netPct,
    netApr: netPct * (365 / days),
    ...(usdPerRaw1 ? { valueUsd: (value + fees) * usdPerRaw1 } : {}),
    nowInRange: now.tick >= t.tl && now.tick < t.tu,
  };
}

/** Too small to bother tracking, once its dollar value is known. */
export function tooSmall(t: Tracked, usdPerRaw1?: number): boolean {
  if (!usdPerRaw1) return false;
  const [a0, a1] = amountsPerL(t.sp0, Math.pow(1.0001, t.tl / 2), Math.pow(1.0001, t.tu / 2));
  return (a0 * t.sp0 * t.sp0 + a1) * Number(t.L) * usdPerRaw1 < TRACK_MIN_USD;
}

/** The pool's smart LPs: mostly in range, big enough, and ahead of just holding; best first. */
export function rankPool(results: SmartLp[]): PoolSmartLps & { all: number } {
  const smart = results
    .filter((r) => r.netPct > 0 && (r.inRangePct ?? 100) >= SMART_MIN_IN_RANGE && (r.valueUsd == null || r.valueUsd >= SMART_MIN_USD))
    .sort((a, b) => b.netApr - a.netApr);
  return { tracked: 0, measured: results.length, smart: smart.length, top: smart.slice(0, 10), all: results.length };
}
