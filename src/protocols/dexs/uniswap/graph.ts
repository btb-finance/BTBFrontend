/**
 * Shared client for Uniswap's official subgraphs on The Graph's decentralized
 * network. Pool discovery for the Earn tab comes straight from the protocol's
 * own indexers — real pool address, fee tier, 24h volume and 24h fees — so we
 * can show volume and compute fee APR from actual fees earned:
 *
 *   feeApr = fees24h / TVL * 365 * 100
 *
 * Used by `v3/subgraph.ts` and `v4/subgraph.ts` (the V4 subgraph schema is
 * based on V3's, so one query shape covers both). The gateway needs a free
 * Graph API key — set NEXT_PUBLIC_GRAPH_KEY. Without it `src/lib/pools.ts`
 * falls back to DeFiLlama. The keyless Envio multichain V4 indexer
 * (github.com/enviodev/uniswap-v4-indexer) is a candidate alternative source.
 */

const GRAPH_KEY = process.env.NEXT_PUBLIC_GRAPH_KEY ?? '';

export const hasGraphKey = GRAPH_KEY.length > 0;

export interface IndexedPool {
  /** V3: pool address. V4: bytes32 pool id. */
  id: string;
  version: 'v3' | 'v4';
  token0: { address: `0x${string}`; symbol: string; decimals: number };
  token1: { address: `0x${string}`; symbol: string; decimals: number };
  /** Fee tier in hundredths of a bip (500 = 0.05%). V4 dynamic-fee = 0x800000 flag. */
  feeTier: number;
  /** V4 only — zero address means no hook. */
  hooks?: `0x${string}`;
  tvlUsd: number;
  /** Volume and LP fees over the last complete UTC day. */
  volume24hUsd: number;
  fees24hUsd: number;
  /** Annualized fee APR % — fees24h / TVL * 365. No incentives included. */
  feeApr: number;
}

interface RawDayData { date: number; volumeUSD: string; feesUSD: string }
interface RawPool {
  id: string;
  feeTier: string;
  hooks?: string;
  totalValueLockedUSD: string;
  token0: { id: string; symbol: string; decimals: string };
  token1: { id: string; symbol: string; decimals: string };
  poolDayData: RawDayData[];
}

async function gatewayQuery<T>(subgraphId: string, query: string, variables: Record<string, unknown>): Promise<T> {
  if (!hasGraphKey) throw new Error('NEXT_PUBLIC_GRAPH_KEY not set');
  const res = await fetch(`https://gateway.thegraph.com/api/${GRAPH_KEY}/subgraphs/id/${subgraphId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`subgraph ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message ?? 'subgraph error');
  return json.data as T;
}

const V3_QUERY = `query TopPools($limit: Int!, $minTvl: BigDecimal!) {
  pools(
    first: $limit
    orderBy: totalValueLockedUSD
    orderDirection: desc
    where: { totalValueLockedUSD_gt: $minTvl, volumeUSD_gt: "1000000", liquidity_gt: 0 }
  ) {
    id
    feeTier
    totalValueLockedUSD
    token0 { id symbol decimals }
    token1 { id symbol decimals }
    poolDayData(first: 2, orderBy: date, orderDirection: desc) {
      date
      volumeUSD
      feesUSD
    }
  }
}`;

async function queryTopPoolsV3(subgraphId: string, limit: number, minTvlUsd: number): Promise<IndexedPool[]> {
  const data = await gatewayQuery<{ pools: RawPool[] }>(subgraphId, V3_QUERY, { limit, minTvl: String(minTvlUsd) });
  const todayBucket = Math.floor(Date.now() / 1000 / 86400) * 86400;

  return (data.pools ?? [])
    .map((r): IndexedPool => {
      const tvlUsd = Number(r.totalValueLockedUSD) || 0;
      // Today's bucket is partial — use the last complete day for volume/fees.
      const day = r.poolDayData.find((d) => d.date < todayBucket) ?? r.poolDayData[0];
      const volume24hUsd = Number(day?.volumeUSD) || 0;
      const fees24hUsd = Number(day?.feesUSD) || 0;
      return {
        id: r.id,
        version: 'v3',
        token0: { address: r.token0.id as `0x${string}`, symbol: r.token0.symbol, decimals: Number(r.token0.decimals) },
        token1: { address: r.token1.id as `0x${string}`, symbol: r.token1.symbol, decimals: Number(r.token1.decimals) },
        feeTier: Number(r.feeTier),
        tvlUsd,
        volume24hUsd,
        fees24hUsd,
        feeApr: tvlUsd > 0 ? (fees24hUsd / tvlUsd) * 365 * 100 : 0,
      };
    })
    // Pools with fake/donated TVL rank high in the ordering but do no trades —
    // require real activity on the last complete day.
    .filter((p) => p.volume24hUsd > 0 && p.token0.symbol && p.token1.symbol);
}

/**
 * The deployed V4 Ethereum subgraph (8B2wKxnk…) uses a custom schema: Pool has
 * `fee`/`hooks` (no feeTier, no poolDayData) plus cumulative volume/fees
 * snapshots in `PoolSnapshot`. Its precomputed `apr24h` is on an in-range
 * liquidity basis (~20×+ a whole-pool APR), so to stay comparable with the V3
 * rows we derive 24h volume/fees ourselves from snapshot deltas.
 */
const V4_QUERY = `query TopPools($limit: Int!, $minTvl: BigDecimal!) {
  pools(
    first: $limit
    orderBy: totalValueLockedUSD
    orderDirection: desc
    where: { totalValueLockedUSD_gt: $minTvl, volumeUSD_gt: "1000000", liquidity_gt: 0 }
  ) {
    id
    fee
    hooks
    totalValueLockedUSD
    token0 { id symbol decimals }
    token1 { id symbol decimals }
  }
}`;

const V4_SNAPSHOTS_QUERY = `query Snapshots($pools: [String!], $since: BigInt!) {
  poolSnapshots(
    first: 1000
    orderBy: timestamp
    orderDirection: asc
    where: { pool_in: $pools, timestamp_gt: $since }
  ) {
    pool { id }
    timestamp
    volumeUSD
    feesUSD
  }
}`;

interface RawV4Pool {
  id: string; fee: number; hooks: string; totalValueLockedUSD: string;
  token0: { id: string; symbol: string; decimals: string };
  token1: { id: string; symbol: string; decimals: string };
}
interface RawSnapshot { pool: { id: string }; timestamp: string; volumeUSD: string; feesUSD: string }

async function queryTopPoolsV4(subgraphId: string, limit: number, minTvlUsd: number): Promise<IndexedPool[]> {
  const data = await gatewayQuery<{ pools: RawV4Pool[] }>(subgraphId, V4_QUERY, { limit, minTvl: String(minTvlUsd) });
  const pools = (data.pools ?? []).filter((p) => p.token0.symbol && p.token1.symbol);
  if (pools.length === 0) return [];

  // One batched query: cumulative volume/fees snapshots over the last ~30h,
  // then 24h figures come from first→last deltas scaled to a day.
  const since = Math.floor(Date.now() / 1000) - 30 * 3600;
  const snaps = await gatewayQuery<{ poolSnapshots: RawSnapshot[] }>(
    subgraphId, V4_SNAPSHOTS_QUERY, { pools: pools.map((p) => p.id), since: String(since) },
  );
  const byPool = new Map<string, RawSnapshot[]>();
  for (const s of snaps.poolSnapshots ?? []) {
    const list = byPool.get(s.pool.id) ?? [];
    list.push(s);
    byPool.set(s.pool.id, list);
  }

  return pools
    .map((r): IndexedPool => {
      const tvlUsd = Number(r.totalValueLockedUSD) || 0;
      const list = byPool.get(r.id) ?? [];
      let volume24hUsd = 0, fees24hUsd = 0;
      if (list.length >= 2) {
        const first = list[0], last = list[list.length - 1];
        const dt = Number(last.timestamp) - Number(first.timestamp);
        if (dt >= 6 * 3600) { // need a wide-enough window to scale meaningfully
          const scale = 86400 / dt;
          volume24hUsd = Math.max(0, (Number(last.volumeUSD) - Number(first.volumeUSD)) * scale);
          fees24hUsd = Math.max(0, (Number(last.feesUSD) - Number(first.feesUSD)) * scale);
        }
      }
      return {
        id: r.id,
        version: 'v4',
        token0: { address: r.token0.id as `0x${string}`, symbol: r.token0.symbol, decimals: Number(r.token0.decimals) },
        token1: { address: r.token1.id as `0x${string}`, symbol: r.token1.symbol, decimals: Number(r.token1.decimals) },
        feeTier: Number(r.fee),
        hooks: r.hooks as `0x${string}`,
        tvlUsd,
        volume24hUsd,
        fees24hUsd,
        feeApr: tvlUsd > 0 ? (fees24hUsd / tvlUsd) * 365 * 100 : 0,
      };
    })
    .filter((p) => p.volume24hUsd > 0);
}

export function queryTopPools(
  subgraphId: string,
  version: 'v3' | 'v4',
  limit: number,
  minTvlUsd: number,
): Promise<IndexedPool[]> {
  return version === 'v3' ? queryTopPoolsV3(subgraphId, limit, minTvlUsd) : queryTopPoolsV4(subgraphId, limit, minTvlUsd);
}

export interface PoolDay {
  date: number;        // UTC day bucket (unix seconds)
  price0: number;      // token0 price in token1 (human units) at day close
  volumeUsd: number;
  feesUsd: number;
  tvlUsd: number;
}

// NOTE: subgraph token1Price is "token1 per token0" — the same units as the
// mint modal's price/min/max (verified live: USDC/WETH ≈ 6e-4, not 1648).
const HISTORY_QUERY = `query PoolHistory($id: ID!, $days: Int!) {
  pool(id: $id) {
    poolDayData(first: $days, orderBy: date, orderDirection: desc) {
      date
      token1Price
      volumeUSD
      feesUSD
      tvlUSD
    }
  }
}`;

/** Daily history for one pool (ascending by day) — price chart + fee estimates. V3 schema only. */
export async function getPoolHistory(subgraphId: string, poolId: string, days = 30): Promise<PoolDay[]> {
  const data = await gatewayQuery<{ pool: { poolDayData: { date: number; token1Price: string; volumeUSD: string; feesUSD: string; tvlUSD: string }[] } | null }>(
    subgraphId, HISTORY_QUERY, { id: poolId.toLowerCase(), days },
  );
  return (data.pool?.poolDayData ?? [])
    .map((r) => ({
      date: r.date,
      price0: Number(r.token1Price) || 0,
      volumeUsd: Number(r.volumeUSD) || 0,
      feesUsd: Number(r.feesUSD) || 0,
      tvlUsd: Number(r.tvlUSD) || 0,
    }))
    .reverse();
}

/** The official Uniswap V3 Ethereum subgraph id — re-exported for history lookups. */
export const V3_SUBGRAPH_ID = '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';

// V3-schema subgraphs (Uniswap V3, PancakeSwap V3, the V4 fork) index a
// Position entity with an `owner` — one query enumerates a wallet's position
// tokenIds without the RPC log scans that public endpoints choke on.
const OWNER_POSITIONS_QUERY = `query OwnerPositions($owner: String!) {
  positions(first: 500, where: { owner: $owner }) { id }
}`;

/**
 * TokenIds of every position the owner holds, from a subgraph. Throws when the
 * Graph key is missing or the schema has no Position entity — callers fall
 * back to on-chain discovery.
 */
export async function getOwnerPositionIds(subgraphId: string, owner: string): Promise<bigint[]> {
  const data = await gatewayQuery<{ positions: { id: string }[] }>(
    subgraphId, OWNER_POSITIONS_QUERY, { owner: owner.toLowerCase() },
  );
  return (data.positions ?? [])
    .map((p) => { try { return BigInt(p.id); } catch { return null; } })
    .filter((x): x is bigint => x !== null);
}

const DYNAMIC_FEE_FLAG = 0x800000;

/** 500 -> "0.05%", 3000 -> "0.3%", V4 dynamic-fee flag -> "Dynamic". */
export function fmtFeeTier(feeTier: number): string {
  if (feeTier & DYNAMIC_FEE_FLAG) return 'Dynamic';
  return `${(feeTier / 10_000).toString().replace(/\.?0+$/, '') || '0'}%`;
}
