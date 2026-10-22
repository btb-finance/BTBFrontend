import { encodeFunctionData, maxUint256, parseAbi, parseEventLogs, type Log, type PublicClient } from 'viem';
import type { Call } from './txRunner';
import type { LiquidityPosition } from '@/protocols/types';
import { AERO_POSITION_MANAGER, aeroDeploymentFor } from '@/protocols/dexs/aerodrome';
import { SLIPSTREAM_FACTORY_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { addMinimums, removeMinimums } from '@/protocols/dexs/uniswap/v3/math';
import { withSafeMulticall } from './safeMulticall';

/**
 * Moving an old Aerodrome position into Aero. Aero (live 2026-10-22) no longer supports the old Aerodrome pools: their
 * gauges were killed and liquidity is moving to Aero's pools. Aero's own LpMigrator does the move in one transaction:
 * it takes the old position (the caller approves it first), removes all liquidity, collects the fees, burns the NFT,
 * mints the same tokens into an Aero pool for the pair and sends anything left over back to the caller. Same address
 * on every network (Dromos-Labs/metadex-slipstream-public deployment-addresses, lpMigrator).
 */
export const AERO_LP_MIGRATOR = '0x293Ba185d875B5c562B552082cfef630dab57baD' as const;

const MIGRATOR_ABI = parseAbi([
  'struct FromParams { address nft; uint256 tokenId; uint256 amount0Min; uint256 amount1Min; uint256 amount0Extra; uint256 amount1Extra; }',
  'struct ToParams { address nft; int24 tickSpacing; int24 tickLower; int24 tickUpper; uint256 amount0Desired; uint256 amount1Desired; uint256 amount0Min; uint256 amount1Min; address recipient; uint256 deadline; address pool; }',
  'function migrateSlipstreamToSlipstream(FromParams fromParams, ToParams toParams) returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'event MigratedSlipstreamToSliptream(address indexed sender, uint256 indexed fromTokenId, uint256 indexed toTokenId)',
]);
const APPROVE_ABI = parseAbi(['function approve(address to, uint256 tokenId)']);
const POOL_ABI = parseAbi([
  'function liquidity() view returns (uint128)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, bool)',
]);
const ZERO = '0x0000000000000000000000000000000000000000';

export interface AeroTarget {
  pool: `0x${string}`;
  tickSpacing: number;
  sqrtPriceX96: bigint;
  /** The old range, widened to the nearest ticks the Aero pool allows. */
  tickLower: number;
  tickUpper: number;
}

/** The Aero pool to move into: the deepest one for the pair. Null when Aero has no pool with liquidity for it. */
export async function findAeroTarget(client: PublicClient, chainId: number, pos: LiquidityPosition): Promise<AeroTarget | null> {
  const d = aeroDeploymentFor(chainId);
  if (!d) return null;
  const found = await withSafeMulticall(client).multicall({
    contracts: d.feeTiers.map((s) => ({ address: d.factory, abi: SLIPSTREAM_FACTORY_ABI, functionName: 'getPool' as const, args: [pos.token0, pos.token1, s] as const })),
    allowFailure: true,
  });
  const pools = d.feeTiers
    .map((s, i) => ({ s, pool: found[i].status === 'success' ? (found[i].result as `0x${string}`) : null }))
    .filter((x): x is { s: number; pool: `0x${string}` } => !!x.pool && x.pool.toLowerCase() !== ZERO);
  if (pools.length === 0) return null;
  const state = await withSafeMulticall(client).multicall({
    contracts: pools.flatMap((x) => [
      { address: x.pool, abi: POOL_ABI, functionName: 'liquidity' as const },
      { address: x.pool, abi: POOL_ABI, functionName: 'slot0' as const },
    ]),
    allowFailure: true,
  });
  let best: { s: number; pool: `0x${string}`; liquidity: bigint; sqrtPriceX96: bigint } | null = null;
  pools.forEach((x, i) => {
    const l = state[2 * i], s0 = state[2 * i + 1];
    if (l.status !== 'success' || s0.status !== 'success') return;
    const liquidity = l.result as bigint;
    const sqrtPriceX96 = (s0.result as readonly [bigint, number, number, number, number, boolean])[0];
    if (liquidity > 0n && (!best || liquidity > best.liquidity)) best = { ...x, liquidity, sqrtPriceX96 };
  });
  if (!best) return null;
  const b = best as { s: number; pool: `0x${string}`; liquidity: bigint; sqrtPriceX96: bigint };
  // Keep the range: round the edges outward to the new spacing, so the position covers at least what it did.
  const tickLower = Math.floor(pos.tickLower / b.s) * b.s;
  let tickUpper = Math.ceil(pos.tickUpper / b.s) * b.s;
  if (tickUpper <= tickLower) tickUpper = tickLower + b.s;
  return { pool: b.pool, tickSpacing: b.s, sqrtPriceX96: b.sqrtPriceX96, tickLower, tickUpper };
}

/**
 * Approve the migrator for this one position, then migrate it. Minimums guard both halves against a price move of up
 * to `slippageBps`: what comes out of the old pool, and (from that worst case) what goes into the Aero pool.
 */
export function buildMigrateCalls(pos: LiquidityPosition, owner: `0x${string}`, target: AeroTarget, slippageBps = 100): Call[] {
  const oldPm = pos.positionManager as `0x${string}`;
  const [out0, out1] = removeMinimums(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, pos.liquidity, slippageBps);
  const [in0, in1] = addMinimums(target.sqrtPriceX96, target.tickLower, target.tickUpper, out0, out1, slippageBps);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
  return [
    { to: oldPm, label: 'Allow the move', data: encodeFunctionData({ abi: APPROVE_ABI, functionName: 'approve', args: [AERO_LP_MIGRATOR, pos.id] }) },
    {
      to: AERO_LP_MIGRATOR,
      label: 'Move to Aero',
      data: encodeFunctionData({
        abi: MIGRATOR_ABI,
        functionName: 'migrateSlipstreamToSlipstream',
        args: [
          { nft: oldPm, tokenId: pos.id, amount0Min: out0, amount1Min: out1, amount0Extra: 0n, amount1Extra: 0n },
          {
            nft: AERO_POSITION_MANAGER, tickSpacing: target.tickSpacing, tickLower: target.tickLower, tickUpper: target.tickUpper,
            // The migrator caps these at what the old position paid out, so "everything" is the whole amount.
            amount0Desired: maxUint256, amount1Desired: maxUint256, amount0Min: in0, amount1Min: in1,
            recipient: owner, deadline, pool: target.pool,
          },
        ],
      }),
    },
  ];
}

/** The new Aero position's id, from the migration's receipt logs. */
export function migratedTokenId(logs: Log[]): bigint | null {
  const ev = parseEventLogs({ abi: MIGRATOR_ABI, logs, eventName: 'MigratedSlipstreamToSliptream' })[0];
  return ev ? ev.args.toTokenId : null;
}
