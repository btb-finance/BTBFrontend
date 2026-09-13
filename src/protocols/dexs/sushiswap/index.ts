import type { V3Deployment } from '../uniswap/v3/addresses';
import { SUSHI_V3_ROBINHOOD_DEPLOYMENT } from '../robinhood';

/** SushiSwap V3 on Ethereum mainnet: a byte-compatible Uniswap V3 fork.
 * Manager's factory() and the factory's feeAmountTickSpacing verified on-chain. */
export const SUSHI_V3_MAINNET_DEPLOYMENT: V3Deployment = {
  protocol: 'sushiswap-v3',
  chainId: 1,
  label: 'SushiSwap V3',
  positionManager: '0x2214A42d8e2A1d20635c2cb0664422c528B6A432',
  factory: '0xbACEB8eC6b9355Dfc0269C18bac9d6E2Bdc29C4F',
  feeTiers: [100, 500, 3000, 10000],
  tickSpacings: { 100: 1, 500: 10, 3000: 60, 10000: 200 },
};

export const SUSHI_V3_DEPLOYMENTS: Record<number, V3Deployment> = {
  1: SUSHI_V3_MAINNET_DEPLOYMENT,
  4663: SUSHI_V3_ROBINHOOD_DEPLOYMENT,
};

export function sushiV3DeploymentForChain(chainId: number): V3Deployment | null {
  return SUSHI_V3_DEPLOYMENTS[chainId] ?? null;
}
