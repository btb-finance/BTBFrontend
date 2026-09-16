import { formatUnits, parseAbiItem, type PublicClient } from 'viem';
import type { V3Deployment } from '@/protocols/dexs/uniswap/v3/addresses';
import { CHAIN_DATA_NETWORKS } from './chainDataNetworks';

/**
 * Position history straight from the chain, for chains no analytics provider
 * indexes (Robinhood) and as a check elsewhere.
 *
 * A V3-style position manager emits three events per tokenId, all indexed
 * by tokenId so each is one cheap getLogs call:
 *   IncreaseLiquidity  deposits (the mint is the first one)
 *   DecreaseLiquidity  principal moved to tokensOwed
 *   Collect            everything paid out: principal from decreases plus fees
 * Fees claimed = collected minus decreased, per token. USD at the time comes
 * from DeFiLlama's historical price endpoint when the chain is covered,
 * otherwise from the current price (marked estimated).
 */

const INCREASE = parseAbiItem('event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)');
const DECREASE = parseAbiItem('event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)');
const COLLECT = parseAbiItem('event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)');
const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)');

export interface HistoryEvent {
  kind: 'deposit' | 'withdraw' | 'collect';
  block: bigint;
  timestamp: number;         // seconds
  amount0: bigint;
  amount1: bigint;
  usd?: number;
}

export interface PositionHistory {
  tokenId: bigint;
  events: HistoryEvent[];
  openedAt?: number;         // seconds
  closedAt?: number;         // seconds, when liquidity reached zero and everything was collected
  depositsUsd: number;
  withdrawalsUsd: number;
  feesClaimedUsd: number;
  feesClaimed0: bigint;
  feesClaimed1: bigint;
  deposits0: bigint;
  deposits1: bigint;
  withdrawals0: bigint;
  withdrawals1: bigint;
  /** True when any USD figure used the current price instead of the price at the time. */
  estimated: boolean;
}

const CACHE_TTL = 10 * 60_000;
const memo = new Map<string, { at: number; value: PositionHistory }>();

async function priceAt(chainId: number, token: string, ts: number, fallback: number): Promise<{ price: number; estimated: boolean }> {
  const slug = CHAIN_DATA_NETWORKS[chainId]?.llama;
  if (!slug || chainId === 4663) return { price: fallback, estimated: true };
  try {
    const res = await fetch(`https://coins.llama.fi/prices/historical/${ts}/${slug}:${token.toLowerCase()}?searchWidth=6h`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { price: fallback, estimated: true };
    const json = await res.json() as { coins?: Record<string, { price?: number }> };
    const p = json.coins?.[`${slug}:${token.toLowerCase()}`]?.price;
    return p != null && p > 0 ? { price: p, estimated: false } : { price: fallback, estimated: true };
  } catch { return { price: fallback, estimated: true }; }
}

async function logsFrom(client: PublicClient, address: `0x${string}`, event: typeof INCREASE | typeof DECREASE | typeof COLLECT, tokenId: bigint, fromBlock: bigint) {
  const run = (from: bigint) => client.getLogs({ address, event, args: { tokenId }, fromBlock: from, toBlock: 'latest' });
  try {
    return await run(fromBlock);
  } catch {
    // Some public RPCs cap the range; retry over roughly the last six months.
    const head = await client.getBlockNumber();
    const recent = head > 12_000_000n ? head - 12_000_000n : 0n;
    return run(recent > fromBlock ? recent : fromBlock);
  }
}

export async function fetchPositionHistory(
  client: PublicClient,
  chainId: number,
  d: V3Deployment,
  tokenId: bigint,
  meta: { token0: `0x${string}`; token1: `0x${string}`; decimals0: number; decimals1: number },
  currentUsd: { p0: number; p1: number },
  fromBlock: bigint = 0n,
): Promise<PositionHistory> {
  const key = `${chainId}:${d.positionManager}:${tokenId}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;

  const [inc, dec, col] = await Promise.all([
    logsFrom(client, d.positionManager, INCREASE, tokenId, fromBlock),
    logsFrom(client, d.positionManager, DECREASE, tokenId, fromBlock),
    logsFrom(client, d.positionManager, COLLECT, tokenId, fromBlock),
  ]);

  const raw: Omit<HistoryEvent, 'timestamp'>[] = [
    ...inc.map((l) => ({ kind: 'deposit' as const, block: l.blockNumber!, amount0: l.args.amount0!, amount1: l.args.amount1! })),
    ...dec.map((l) => ({ kind: 'withdraw' as const, block: l.blockNumber!, amount0: l.args.amount0!, amount1: l.args.amount1! })),
    ...col.map((l) => ({ kind: 'collect' as const, block: l.blockNumber!, amount0: l.args.amount0!, amount1: l.args.amount1! })),
  ].sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0));

  // One timestamp per distinct block.
  const blocks = [...new Set(raw.map((e) => e.block))];
  const times = new Map<bigint, number>();
  await Promise.all(blocks.map(async (b) => { try { const blk = await client.getBlock({ blockNumber: b }); times.set(b, Number(blk.timestamp)); } catch { times.set(b, Math.floor(Date.now() / 1000)); } }));

  // Collect pays principal from earlier decreases plus fees; net the two per token.
  let owed0 = 0n, owed1 = 0n, feesClaimed0 = 0n, feesClaimed1 = 0n, deposits0 = 0n, deposits1 = 0n, withdrawals0 = 0n, withdrawals1 = 0n;
  let estimated = false;
  const priceCache = new Map<string, { price: number; estimated: boolean }>();
  const usdFor = async (token: string, ts: number, fallback: number) => {
    const k = `${token}:${Math.floor(ts / 3600)}`;
    let v = priceCache.get(k);
    if (!v) { v = await priceAt(chainId, token, ts, fallback); priceCache.set(k, v); }
    if (v.estimated) estimated = true;
    return v.price;
  };

  const events: HistoryEvent[] = [];
  let depositsUsd = 0, withdrawalsUsd = 0, feesClaimedUsd = 0;
  for (const e of raw) {
    const ts = times.get(e.block) ?? Math.floor(Date.now() / 1000);
    const [p0, p1] = await Promise.all([usdFor(meta.token0, ts, currentUsd.p0), usdFor(meta.token1, ts, currentUsd.p1)]);
    const value = (a0: bigint, a1: bigint) => parseFloat(formatUnits(a0, meta.decimals0)) * p0 + parseFloat(formatUnits(a1, meta.decimals1)) * p1;
    if (e.kind === 'deposit') { deposits0 += e.amount0; deposits1 += e.amount1; const usd = value(e.amount0, e.amount1); depositsUsd += usd; events.push({ ...e, timestamp: ts, usd }); }
    else if (e.kind === 'withdraw') { owed0 += e.amount0; owed1 += e.amount1; withdrawals0 += e.amount0; withdrawals1 += e.amount1; const usd = value(e.amount0, e.amount1); withdrawalsUsd += usd; events.push({ ...e, timestamp: ts, usd }); }
    else {
      const f0 = e.amount0 > owed0 ? e.amount0 - owed0 : 0n; const f1 = e.amount1 > owed1 ? e.amount1 - owed1 : 0n;
      owed0 = e.amount0 > owed0 ? 0n : owed0 - e.amount0; owed1 = e.amount1 > owed1 ? 0n : owed1 - e.amount1;
      feesClaimed0 += f0; feesClaimed1 += f1;
      const usd = value(f0, f1); feesClaimedUsd += usd;
      events.push({ ...e, timestamp: ts, amount0: f0, amount1: f1, usd });
    }
  }

  const openedAt = events.find((e) => e.kind === 'deposit')?.timestamp;
  const value: PositionHistory = { tokenId, events, openedAt, depositsUsd, withdrawalsUsd, feesClaimedUsd, feesClaimed0, feesClaimed1, deposits0, deposits1, withdrawals0, withdrawals1, estimated };
  memo.set(key, { at: Date.now(), value });
  return value;
}

/** Token ids this owner once held on a manager and no longer does (burned or transferred away). */
export async function fetchPastTokenIds(client: PublicClient, manager: `0x${string}`, owner: `0x${string}`, fromBlock: bigint = 0n): Promise<bigint[]> {
  const run = async (from: bigint) => {
    const [received, sent] = await Promise.all([
      client.getLogs({ address: manager, event: TRANSFER, args: { to: owner }, fromBlock: from, toBlock: 'latest' }),
      client.getLogs({ address: manager, event: TRANSFER, args: { from: owner }, fromBlock: from, toBlock: 'latest' }),
    ]);
    const held = new Set(received.map((l) => l.args.tokenId!.toString()));
    const gone = new Set(sent.map((l) => l.args.tokenId!.toString()));
    return [...gone].filter((id) => held.has(id)).map((id) => BigInt(id));
  };
  try { return await run(fromBlock); } catch {
    try { const head = await client.getBlockNumber(); return await run(head > 12_000_000n ? head - 12_000_000n : 0n); } catch { return []; }
  }
}

/**
 * Empty positions the owner still holds on a manager: liquidity zero and
 * nothing owed. The live fetcher drops these, so the closed ledger reads them
 * here with their pool facts, then prices their history.
 */
export async function fetchEmptyPositions(client: PublicClient, d: V3Deployment, owner: `0x${string}`, npmAbi: readonly unknown[]): Promise<{ tokenId: bigint; token0: `0x${string}`; token1: `0x${string}`; fee: number }[]> {
  const abi = npmAbi as import('viem').Abi;
  const count = Number(await client.readContract({ address: d.positionManager, abi, functionName: 'balanceOf', args: [owner] }) as bigint);
  if (count === 0) return [];
  const ids = await Promise.all(Array.from({ length: Math.min(count, 60) }, (_, i) => client.readContract({ address: d.positionManager, abi, functionName: 'tokenOfOwnerByIndex', args: [owner, BigInt(i)] }) as Promise<bigint>));
  const out: { tokenId: bigint; token0: `0x${string}`; token1: `0x${string}`; fee: number }[] = [];
  await Promise.all(ids.map(async (id) => {
    try {
      const r = await client.readContract({ address: d.positionManager, abi, functionName: 'positions', args: [id] }) as readonly unknown[];
      // Standard struct: [nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, fg0, fg1, owed0, owed1]; compact forks shift by two.
      const off = d.compactPositions ? -2 : 0;
      const liquidity = r[7 + off] as bigint, owed0 = r[10 + off] as bigint, owed1 = r[11 + off] as bigint;
      if (liquidity === 0n && owed0 === 0n && owed1 === 0n) out.push({ tokenId: id, token0: r[2 + off] as `0x${string}`, token1: r[3 + off] as `0x${string}`, fee: Number(r[4 + off]) });
    } catch { /* burned or unreadable */ }
  }));
  return out;
}
