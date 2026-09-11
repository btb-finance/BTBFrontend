/**
 * Aerodrome Slipstream (concentrated liquidity) — Base only.
 *
 * Slipstream is a Uniswap V3 fork with one structural difference: pools are
 * keyed by tickSpacing, not fee. The NonfungiblePositionManager's positions()
 * returns tickSpacing where V3 returns fee, mint() takes tickSpacing (plus a
 * sqrtPriceX96 used only to initialise a fresh pool), and the factory's
 * getPool takes tickSpacing. Fees are a per-pool value read from pool.fee().
 * decreaseLiquidity / collect / increaseLiquidity / burn are byte-identical,
 * so the shared V3 actions work once the deployment is flagged `slipstream`.
 *
 * Aerodrome has shipped three position managers on Base (initial, gauge caps,
 * gauges V3); all three still hold live positions, so every wallet is read
 * against all of them. Addresses from github.com/aerodrome-finance/slipstream,
 * factories confirmed on-chain via NonfungiblePositionManager.factory().
 */
import type { PublicClient } from 'viem';
import type { V3Deployment } from '../uniswap/v3/addresses';
import { fetchV3Positions } from '../uniswap/v3/positions';
import type { LiquidityPosition } from '@/protocols/types';

export const PROTOCOL = 'aerodrome-cl';
export const BASE_CHAIN_ID = 8453;
export const BASE_WETH = '0x4200000000000000000000000000000000000006' as const;

/** Slipstream tick spacings; there is no fee tier list, fees live on the pool. */
const SLIPSTREAM_TICK_SPACINGS = [1, 50, 100, 200, 2000] as const;

function slipstreamDeployment(positionManager: `0x${string}`, factory: `0x${string}`): V3Deployment {
  return {
    protocol: 'aerodrome-cl',
    slipstream: true,
    chainId: BASE_CHAIN_ID,
    positionManager,
    factory,
    // Keyed by tickSpacing on Slipstream: a "tier" is its spacing.
    feeTiers: SLIPSTREAM_TICK_SPACINGS,
    tickSpacings: Object.fromEntries(SLIPSTREAM_TICK_SPACINGS.map((s) => [s, s])),
  };
}

export const AERODROME_CL_DEPLOYMENTS: readonly V3Deployment[] = [
  slipstreamDeployment('0x827922686190790b37229fd06084350E74485b72', '0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A'),
  slipstreamDeployment('0xa990C6a764b73BF43cee5Bb40339c3322FB9D55F', '0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a'),
  slipstreamDeployment('0xe1f8cd9AC4e4A65F54f38a5CdAfCA44f6dD68b53', '0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef'),
];

/** The deployment a position was read from — carried on the position itself. */
export function aerodromeDeploymentOf(p: LiquidityPosition): V3Deployment {
  const pm = p.positionManager?.toLowerCase();
  return AERODROME_CL_DEPLOYMENTS.find((d) => d.positionManager.toLowerCase() === pm) ?? AERODROME_CL_DEPLOYMENTS[0];
}

/** Every Slipstream position the wallet holds on Base, across all three managers. */
export async function fetchAerodromePositions(client: PublicClient, owner: `0x${string}`): Promise<LiquidityPosition[]> {
  const results = await Promise.allSettled(AERODROME_CL_DEPLOYMENTS.map((d) => fetchV3Positions(client, owner, d)));
  const ok = results.filter((r): r is PromiseFulfilledResult<LiquidityPosition[]> => r.status === 'fulfilled');
  if (ok.length === 0) throw (results[0] as PromiseRejectedResult).reason;
  return ok.flatMap((r) => r.value);
}
