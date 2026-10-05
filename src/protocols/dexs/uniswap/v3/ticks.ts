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
import { withSafeMulticall } from '@/lib/safeMulticall';

export interface TickLiquidityPoint {
  tick: number;
  price: number; // token1 per token0, human-unscaled (caller rescales for decimals)
  liquidity: number;
}

const WORDS_EACH_SIDE = 12; // ~12*256*tickSpacing ticks of coverage each direction

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

  const bitmapRes = await withSafeMulticall(client).multicall({
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

  const tickInfoRes = await withSafeMulticall(client).multicall({
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

const ALGEBRA_TICKS_ABI = [
  { name: 'prevTickGlobal', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'int24' }] },
  { name: 'nextTickGlobal', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'int24' }] },
  {
    name: 'ticks', type: 'function', stateMutability: 'view', inputs: [{ type: 'int24' }],
    outputs: [
      { name: 'liquidityTotal', type: 'uint256' }, { name: 'liquidityDelta', type: 'int128' },
      { name: 'prevTick', type: 'int24' }, { name: 'nextTick', type: 'int24' },
      { name: 'outerFeeGrowth0Token', type: 'uint256' }, { name: 'outerFeeGrowth1Token', type: 'uint256' },
    ],
  },
] as const;
const ALGEBRA_STEPS_EACH_SIDE = 40;
const ALGEBRA_EDGE = 887272;

/**
 * The same depth for an Algebra Integral pool (Alandale). Algebra keeps its initialized ticks as a linked list, so
 * instead of bitmap words this walks from the ticks either side of the price (prevTickGlobal / nextTickGlobal)
 * outward, a fixed number of steps each way, both directions at once. Same accumulation as above.
 */
export async function fetchAlgebraTickLiquidity(
  client: PublicClient,
  poolAddress: `0x${string}`,
  currentLiquidity: bigint,
): Promise<TickLiquidityPoint[]> {
  const read = (fn: 'prevTickGlobal' | 'nextTickGlobal') => client.readContract({ address: poolAddress, abi: ALGEBRA_TICKS_ABI, functionName: fn }).then(Number);
  const tickAt = (t: number) => client.readContract({ address: poolAddress, abi: ALGEBRA_TICKS_ABI, functionName: 'ticks', args: [t] });
  const [prev, next] = await Promise.all([read('prevTickGlobal'), read('nextTickGlobal')]);

  const walk = async (start: number, up: boolean): Promise<TickLiquidityPoint[]> => {
    const out: TickLiquidityPoint[] = [];
    let liq = currentLiquidity, t = start;
    for (let i = 0; i < ALGEBRA_STEPS_EACH_SIDE && Math.abs(t) < ALGEBRA_EDGE; i++) {
      const info = await tickAt(t);
      const delta = info[1];
      liq = up ? liq + delta : liq - delta;
      out.push({ tick: t, price: priceAtTick(t), liquidity: Number(liq < 0n ? 0n : liq) });
      const step = Number(up ? info[3] : info[2]);
      if (step === t) break;
      t = step;
    }
    return out;
  };
  const [below, above] = await Promise.all([walk(prev, false), walk(next, true)]);
  return [...below, ...above].sort((a, b) => a.tick - b.tick);
}
