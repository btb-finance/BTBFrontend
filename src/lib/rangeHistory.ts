import { parseAbiItem, type PublicClient } from 'viem';

/**
 * Was this range earning? The pool's Swap events carry the tick after every
 * trade, so bucketing them by hour gives an hourly in-range record. Reads
 * the last ~7 days in windows the public RPCs accept, cached per pool.
 */
const SWAP_V3 = parseAbiItem('event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)');
const SWAP_PANCAKE = parseAbiItem('event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint128 protocolFeesToken0, uint128 protocolFeesToken1)');
const SWAP_V4 = parseAbiItem('event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)');

export interface HourBucket { t: number; tick: number | null }

/** Seconds per block, rough, per chain; only used to size the block window. */
const BLOCK_SECONDS: Record<number, number> = { 1: 12, 8453: 2, 56: 0.75, 4663: 0.25, 5042: 0.5, 42161: 0.25, 10: 2, 137: 2 };

const memo = new Map<string, { at: number; ticks: { block: bigint; ts: number; tick: number }[] }>();

async function swapTicks(client: PublicClient, chainId: number, key: string, hours: number, fetchLogs: (from: bigint, to: bigint) => Promise<{ blockNumber: bigint | null; tick: number }[]>) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.ticks;
  const head = await client.getBlockNumber();
  const span = BigInt(Math.ceil((hours * 3600) / (BLOCK_SECONDS[chainId] ?? 2)));
  const start = head > span ? head - span : 0n;
  // Windows of at most 9,000 blocks (Arc and some public RPCs cap there); at most 30 calls.
  const step = 9_000n;
  const windows: [bigint, bigint][] = [];
  for (let from = start; from <= head && windows.length < 30; from += step) windows.push([from, from + step - 1n > head ? head : from + step - 1n]);
  // Newest first so a capped run still covers the recent days.
  windows.reverse();
  const out: { block: bigint; tick: number }[] = [];
  for (const [from, to] of windows) {
    try { const logs = await fetchLogs(from, to); for (const l of logs) if (l.blockNumber != null) out.push({ block: l.blockNumber, tick: l.tick }); } catch { /* window unreadable, keep going */ }
  }
  out.sort((a, b) => (a.block < b.block ? -1 : 1));
  // Timestamps: two anchor blocks, linear in between (block times are steady enough for hourly buckets).
  const [b0, b1] = await Promise.all([client.getBlock({ blockNumber: start }), client.getBlock({ blockNumber: head })]);
  const t0 = Number(b0.timestamp), t1 = Number(b1.timestamp);
  const ticks = out.map((s) => ({ ...s, ts: t0 + ((Number(s.block - start)) / Math.max(1, Number(head - start))) * (t1 - t0) }));
  memo.set(key, { at: Date.now(), ticks });
  return ticks;
}

/** Hourly buckets (oldest first): the last swap tick in each hour, carried forward when an hour had no swap. */
export async function fetchInRangeTimeline(
  client: PublicClient,
  chainId: number,
  pool: { address?: `0x${string}`; v4PoolId?: `0x${string}`; poolManager?: `0x${string}`; pancake?: boolean },
  hours = 168,
): Promise<HourBucket[]> {
  const key = `${chainId}:${pool.address ?? pool.v4PoolId}`;
  const ticks = await swapTicks(client, chainId, key, hours, async (from, to) => {
    if (pool.v4PoolId && pool.poolManager) {
      const logs = await client.getLogs({ address: pool.poolManager, event: SWAP_V4, args: { id: pool.v4PoolId }, fromBlock: from, toBlock: to });
      return logs.map((l) => ({ blockNumber: l.blockNumber, tick: Number(l.args.tick) }));
    }
    if (!pool.address) return [];
    const event = pool.pancake ? SWAP_PANCAKE : SWAP_V3;
    const logs = await client.getLogs({ address: pool.address, event, fromBlock: from, toBlock: to });
    return logs.map((l) => ({ blockNumber: l.blockNumber, tick: Number((l.args as { tick: number | bigint }).tick) }));
  });
  const now = Math.floor(Date.now() / 1000);
  const startHour = Math.floor((now - hours * 3600) / 3600) * 3600;
  const buckets: HourBucket[] = Array.from({ length: hours }, (_, i) => ({ t: startHour + i * 3600, tick: null }));
  let last: number | null = null;
  let j = 0;
  for (const b of buckets) {
    while (j < ticks.length && ticks[j].ts < b.t + 3600) { last = ticks[j].tick; j++; }
    b.tick = last;
  }
  return buckets;
}
