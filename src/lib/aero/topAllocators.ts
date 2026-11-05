/**
 * Where the best sAERO allocators sit now. The ranking is dromos.kitchen's open leaderboard (what each position of 10,000+
 * sAERO earned per sAERO over the last 7 days); it does not say where a position is, so each top one's split is read from
 * the leaf voter on every chain. A position that moved after earning its rank holds a split that has not earned anything
 * yet, so the time of its last move is kept too. Built by the hourly Convex job (convex/aeroAllocator.ts).
 */
import type { Address, PublicClient } from 'viem';
import { readSplits } from './allocator';

export const DROMOS_BOARD_URL = 'https://dromos.kitchen/aero-analytics/leaderboard.json';
export const TOP_ALLOCATORS = 10;

/** `p["7d"]` is [rank or null, USD earned, APR as a fraction, moves]. */
type DromosBoard = {
  asOf: string;
  positions: { id: string; size: number; p: Record<string, [number | null, number, number, number]> }[];
};

export type TopAllocator = {
  rank: number;
  id: string;
  /** sAERO in the position. */
  size: number;
  earned7d: number;
  /** Percent. */
  apr7d: number;
  moves7d: number;
  /** Unix seconds of its latest move on any chain; 0 if never. */
  lastMovedSec: number;
  split: { chainId: number; gauge: Address; share: number }[];
};
export type TopAllocators = { boardAsOf: string; checkedAt: number; positions: TopAllocator[] };

export async function buildTopAllocators(clientFor: (chainId: number) => PublicClient | null, n = TOP_ALLOCATORS): Promise<TopAllocators> {
  const res = await fetch(DROMOS_BOARD_URL, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`dromos.kitchen HTTP ${res.status}`);
  const board = (await res.json()) as DromosBoard;
  if (!Array.isArray(board.positions)) throw new Error('dromos.kitchen: no positions');
  const top = board.positions
    .filter((p) => p.p?.['7d']?.[0] != null)
    .sort((a, b) => (a.p['7d'][0] as number) - (b.p['7d'][0] as number))
    .slice(0, n);
  const splits = await readSplits(clientFor, top.map((p) => BigInt(p.id)));
  return {
    boardAsOf: board.asOf,
    checkedAt: Date.now(),
    positions: top.map((p) => {
      const [rank, earned, apr, moves] = p.p['7d'];
      const s = splits.get(p.id);
      return { rank: rank as number, id: p.id, size: p.size, earned7d: earned, apr7d: apr * 100, moves7d: moves, lastMovedSec: s?.lastMovedSec ?? 0, split: s?.split ?? [] };
    }),
  };
}
