/** Liquidity-depth-by-tick reader for Uniswap V4 pools, via StateView. Same
 * bitmap-walk/accumulation math as V3 (src/protocols/dexs/uniswap/v3/ticks.ts),
 * keyed by poolId instead of a pool contract address. */
import type { Abi, PublicClient } from 'viem';
import { STATE_VIEW_ABI } from './abis';
import { UNISWAP_V4 } from './addresses';
import type { TickLiquidityPoint } from '../v3/ticks';
import { withSafeMulticall } from '@/lib/safeMulticall';

const WORDS_EACH_SIDE = 12;

function decodeWord(word: bigint, wordPos: number, tickSpacing: number): number[] {
  if (word === 0n) return [];
  const out: number[] = [];
  for (let bit = 0; bit < 256; bit++) {
    if ((word >> BigInt(bit)) & 1n) out.push((wordPos * 256 + bit) * tickSpacing);
  }
  return out;
}

function priceAtTick(tick: number): number {
  return Math.pow(1.0001, tick);
}

export async function fetchV4TickLiquidityDistribution(
  client: PublicClient,
  poolId: `0x${string}`,
  currentTick: number,
  currentLiquidity: bigint,
  tickSpacing: number,
  stateView: `0x${string}` = UNISWAP_V4.stateView,
): Promise<TickLiquidityPoint[]> {
  if (tickSpacing <= 0) return [];
  const compactedTick = Math.floor(currentTick / tickSpacing);
  const currentWordPos = compactedTick >> 8;

  const wordPositions: number[] = [];
  for (let w = currentWordPos - WORDS_EACH_SIDE; w <= currentWordPos + WORDS_EACH_SIDE; w++) wordPositions.push(w);

  const bitmapRes = await withSafeMulticall(client).multicall({
    contracts: wordPositions.map((w) => ({
      address: stateView, abi: STATE_VIEW_ABI as Abi, functionName: 'getTickBitmap', args: [poolId, w],
    })),
    allowFailure: true,
  });

  const initializedTicks: number[] = [];
  bitmapRes.forEach((r, i) => {
    if (r.status !== 'success') return;
    initializedTicks.push(...decodeWord(r.result as bigint, wordPositions[i], tickSpacing));
  });
  if (initializedTicks.length === 0) return [];

  const tickInfoRes = await withSafeMulticall(client).multicall({
    contracts: initializedTicks.map((t) => ({
      address: stateView, abi: STATE_VIEW_ABI as Abi, functionName: 'getTickInfo', args: [poolId, t],
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

  let liq = currentLiquidity;
  const below = sortedTicks.filter((t) => t <= compactedTick * tickSpacing).reverse();
  for (const t of below) {
    liq -= netByTick.get(t)!;
    points.push({ tick: t, price: priceAtTick(t), liquidity: Number(liq) });
  }

  liq = currentLiquidity;
  const above = sortedTicks.filter((t) => t > compactedTick * tickSpacing);
  for (const t of above) {
    liq += netByTick.get(t)!;
    points.push({ tick: t, price: priceAtTick(t), liquidity: Number(liq) });
  }

  return points.sort((a, b) => a.tick - b.tick);
}
