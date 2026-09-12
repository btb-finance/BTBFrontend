/**
 * Where the app can hold, mint and manage concentrated liquidity positions
 * directly on-chain. One place for "which chain, which DEX, which contracts,
 * which wrapped native", so the LP list, the Add liquidity sheet, rebalance
 * and the finder all agree. Chains not listed here show positions read-only
 * through Krystal analytics.
 */
import { UNISWAP_V3_DEPLOYMENT, ROBINHOOD_UNISWAP_V3_DEPLOYMENT, WETH, ROBINHOOD_WETH, uniswapV3DeploymentForChain, type V3Deployment } from './dexs/uniswap/v3/addresses';
import { uniswapV4DeploymentForChain, V4_DEPLOY_BLOCKS, type V4Deployment } from './dexs/uniswap/v4/addresses';
import { PANCAKE_V3_DEPLOYMENT } from './dexs/pancakeswap';
import { AERODROME_CL_DEPLOYMENTS, BASE_WETH } from './dexs/aerodrome';
import { GIGA_V3_DEPLOYMENT, RAMSES_V3_DEPLOYMENT, UP_V3_DEPLOYMENT } from './dexs/robinhood';
import type { LiquidityPosition } from './types';

export const LP_CHAINS = [1, 8453, 56, 4663] as const;
export type LpChainId = (typeof LP_CHAINS)[number];
export type LpDex = 'uniswap' | 'pancakeswap' | 'aerodrome' | 'giga' | 'ramses' | 'up';

export const LP_CHAIN_NAMES: Record<LpChainId, string> = { 1: 'Ethereum', 8453: 'Base', 56: 'BNB Chain', 4663: 'Robinhood Chain' };

/** PancakeSwap V3 uses the same deterministic addresses on these chains. */
export const PANCAKE_V3_CHAINS: readonly number[] = [1, 56, 8453];

export function isLpChain(chainId: number): chainId is LpChainId {
  return (LP_CHAINS as readonly number[]).includes(chainId);
}

export function wrappedNativeFor(chainId: number): `0x${string}` {
  if (chainId === 4663) return ROBINHOOD_WETH;
  if (chainId === 8453) return BASE_WETH;
  if (chainId === 56) return '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
  return WETH;
}

/** Slippage the LP actions default to; Robinhood pools are thin. */
export function lpSlippageBps(chainId: number, base = 50): number {
  return chainId === 4663 ? 500 : base;
}

export function v3DeploymentFor(dex: LpDex, chainId: number): V3Deployment | null {
  if (dex === 'pancakeswap') return PANCAKE_V3_CHAINS.includes(chainId) ? PANCAKE_V3_DEPLOYMENT : null;
  if (dex === 'aerodrome') return chainId === 8453 ? AERODROME_CL_DEPLOYMENTS[2] : null;
  if (dex === 'giga') return chainId === 4663 ? GIGA_V3_DEPLOYMENT : null;
  if (dex === 'ramses') return chainId === 4663 ? RAMSES_V3_DEPLOYMENT : null;
  if (dex === 'up') return chainId === 4663 ? UP_V3_DEPLOYMENT : null;
  return uniswapV3DeploymentForChain(chainId);
}

export function v4DeploymentFor(chainId: number): V4Deployment | null {
  return uniswapV4DeploymentForChain(chainId);
}

export function v4DeployBlockFor(chainId: number): bigint {
  return V4_DEPLOY_BLOCKS[chainId] ?? 0n;
}

/** The V3-style deployment a held position lives on. */
export function deploymentOfPosition(p: LiquidityPosition): V3Deployment {
  const chainId = p.chainId ?? 1;
  if (p.protocol === 'aerodrome-cl') {
    const pm = p.positionManager?.toLowerCase();
    return AERODROME_CL_DEPLOYMENTS.find((d) => d.positionManager.toLowerCase() === pm) ?? AERODROME_CL_DEPLOYMENTS[0];
  }
  if (p.protocol === 'pancakeswap-v3') return PANCAKE_V3_DEPLOYMENT;
  if (p.protocol === 'giga-v3') return GIGA_V3_DEPLOYMENT;
  if (p.protocol === 'ramses-v3') return RAMSES_V3_DEPLOYMENT;
  if (p.protocol === 'up-v3') return UP_V3_DEPLOYMENT;
  return uniswapV3DeploymentForChain(chainId) ?? (chainId === 4663 ? ROBINHOOD_UNISWAP_V3_DEPLOYMENT : UNISWAP_V3_DEPLOYMENT);
}

export function v4DeploymentOfPosition(p: LiquidityPosition): V4Deployment {
  return uniswapV4DeploymentForChain(p.chainId ?? 1) ?? uniswapV4DeploymentForChain(1)!;
}

/** Which held positions the app can act on (withdraw, add, rebalance). */
export function canActOnPosition(p: LiquidityPosition, isNativeOrUnhooked: (hooks?: `0x${string}`) => boolean): boolean {
  const chainId = p.chainId ?? 1;
  if (!isLpChain(chainId)) return false;
  if (p.protocol === 'aerodrome-cl') return chainId === 8453;
  if (p.protocol === 'pancakeswap-v3') return PANCAKE_V3_CHAINS.includes(chainId);
  if (p.protocol === 'giga-v3' || p.protocol === 'ramses-v3' || p.protocol === 'up-v3') return chainId === 4663;
  if (p.protocol === 'uniswap-v4') return !!v4DeploymentFor(chainId) && isNativeOrUnhooked(p.hooks);
  return !!uniswapV3DeploymentForChain(chainId);
}
