/**
 * Liquidity-depth-by-tick reader for Uniswap V3 pools — also used by
 * PancakeSwap V3, which shares the exact same pool ABI/tick math.
 *
 * Walks tickBitmap words outward from the current tick over a fixed window,
 * decodes initialized tick indices, multicalls `ticks()` for each to get
 * liquidityNet, then accumulates active liquidity outward from the pool's
 * current in-range liquidity (standard Uniswap convention: liquidity
 * decreases by liquidityNet as tick goes up past it, increases as tick goes
 * down past it — so walking down from current we subtract, walking up we add).
 */
import type { Abi, PublicClient } from 'viem';
import { POOL_ABI } from './abis';

export interface TickLiquidityPoint {
  tick: number;
  price: number; // token1 per token0, human-unscaled (caller rescales for decimals)
  liquidity: number;
}

const WORDS_EACH_SIDE = 12; // ~12*256*tickSpacing ticks of coverage each direction

function mostSignificantBit(x: bigint): number {
  let n = -1;
  while (x > 0n) { x >>= 1n; n++; }
  return n;
}

/** Decode a tickBitmap word into the initialized tick indices it contains. */
function decodeWord(word: bigint, wordPos: number, tickSpacing: number): number[] {
  if (word === 0n) return [];
  const out: number[] = [];
  for (let bit = 0; bit < 256; bit++) {
    if ((word >> BigInt(bit)) & 1n) {
      out.push((wordPos * 256 + bit) * tickSpacing);
    }
  }
  return out;
}

export async function fetchTickLiquidityDistribution(
  client: PublicClient,
  poolAddress: `0x${string}`,
  currentTick: number,
  currentLiquidity: bigint,
  tickSpacing: number,
): Promise<TickLiquidityPoint[]> {
  if (tickSpacing <= 0) return [];
  const compactedTick = Math.floor(currentTick / tickSpacing);
  const currentWordPos = compactedTick >> 8;

  const wordPositions: number[] = [];
  for (let w = currentWordPos - WORDS_EACH_SIDE; w <= currentWordPos + WORDS_EACH_SIDE; w++) wordPositions.push(w);

  const bitmapRes = await client.multicall({
    contracts: wordPositions.map((w) => ({
      address: poolAddress, abi: POOL_ABI as Abi, functionName: 'tickBitmap', args: [w],
    })),
    allowFailure: true,
  });

  const initializedTicks: number[] = [];
  bitmapRes.forEach((r, i) => {
    if (r.status !== 'success') return;
    initializedTicks.push(...decodeWord(r.result as bigint, wordPositions[i], tickSpacing));
  });
  if (initializedTicks.length === 0) return [];

  const tickInfoRes = await client.multicall({
    contracts: initializedTicks.map((t) => ({
      address: poolAddress, abi: POOL_ABI as Abi, functionName: 'ticks', args: [t],
    })),
    allowFailure: true,
  });

  const netByTick = new Map<number, bigint>();
  tickInfoRes.forEach((r, i) => {
    if (r.status !== 'success') return;
    const liquidityNet = (r.result as readonly unknown[])[1] as bigint;
    netByTick.set(initializedTicks[i], liquidityNet);
  });

  const sortedTicks = [...netByTick.keys()].sort((a, b) => a - b);
  const points: TickLiquidityPoint[] = [];

  // Walking down from current tick: liquidity was `currentLiquidity + net`
  // just below each boundary crossed going downward (subtract net as we pass).
  let liq = currentLiquidity;
  const below = sortedTicks.filter((t) => t <= compactedTick * tickSpacing).reverse();
  for (const t of below) {
    const net = netByTick.get(t)!;
    liq -= net;
    points.push({ tick: t, price: priceAtTick(t), liquidity: Number(liq) });
  }

  liq = currentLiquidity;
  const above = sortedTicks.filter((t) => t > compactedTick * tickSpacing);
  for (const t of above) {
    const net = netByTick.get(t)!;
    liq += net;
    points.push({ tick: t, price: priceAtTick(t), liquidity: Number(liq) });
  }

  return points.sort((a, b) => a.tick - b.tick);
}

function priceAtTick(tick: number): number {
  return Math.pow(1.0001, tick);
}
