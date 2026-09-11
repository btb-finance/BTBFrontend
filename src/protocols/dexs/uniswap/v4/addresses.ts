/**
 * Uniswap V4 — Ethereum mainnet (chain 1) canonical deployments.
 *
 * V4 is a singleton architecture: all pools live in one PoolManager, liquidity
 * is managed via PositionManager using packed "actions" (modifyLiquidities)
 * with Permit2 for token approvals, and reads go through StateView. Native ETH
 * is a first-class currency (address(0)) — no WETH wrapping needed.
 *
 * Addresses are the official Uniswap V4 mainnet deployments
 * (docs.uniswap.org/contracts/v4/deployments).
 */
export const UNISWAP_V4 = {
  poolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90' as `0x${string}`,
  positionManager: '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e' as `0x${string}`,
  stateView: '0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227' as `0x${string}`,
  quoter: '0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203' as `0x${string}`,
  /** Canonical Permit2 (same address across chains). */
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`,
} as const;
export type V4Deployment = typeof UNISWAP_V4;
export const ROBINHOOD_UNISWAP_V4: V4Deployment = {
  poolManager: '0x8366a39cc670b4001a1121b8f6a443a643e40951',
  positionManager: '0x58daec3116aae6d93017baaea7749052e8a04fa7',
  stateView: '0xf3334192d15450cdd385c8b70e03f9a6bd9e673b',
  quoter: '0x8dc178efb8111bb0973dd9d722ebeff267c98f94',
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
};

/**
 * Official Uniswap V4 deployments by chain (docs.uniswap.org/contracts/v4/
 * deployments), verified on-chain: each PositionManager, StateView and Quoter
 * reports the PoolManager listed here. Permit2 is canonical everywhere.
 */
export const UNISWAP_V4_DEPLOYMENTS: Record<number, V4Deployment> = {
  1: UNISWAP_V4,
  4663: ROBINHOOD_UNISWAP_V4,
  8453: {
    poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
    positionManager: '0x7C5f5A4bBd8fD63184577525326123B519429bDc',
    stateView: '0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71',
    quoter: '0x0d5e0F971ED27FBfF6c2837bf31316121532048D',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  56: {
    poolManager: '0x28e2Ea090877bF75740558f6BFB36A5ffeE9e9dF',
    positionManager: '0x7A4a5c919aE2541AeD11041A1AEeE68f1287f95b',
    stateView: '0xd13Dd3D6E93f276FAfc9Db9E6BB47C1180aeE0c4',
    quoter: '0x9F75dD27D6664c475B90e105573E550ff69437B0',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
};

/** Block just before each V4 deployment: lower bound for Transfer-log scans. */
export const V4_DEPLOY_BLOCKS: Record<number, bigint> = {
  1: 21_680_000n,
  4663: 0n,
  8453: 25_350_000n,
  56: 45_970_000n,
};

export function uniswapV4DeploymentForChain(chainId: number): V4Deployment | null {
  return UNISWAP_V4_DEPLOYMENTS[chainId] ?? null;
}

/** V4 represents native ETH as currency address(0) — always sorted as currency0. */
export const NATIVE_CURRENCY = '0x0000000000000000000000000000000000000000' as `0x${string}`;

export function isNativeCurrency(addr: string): boolean {
  return addr.toLowerCase() === NATIVE_CURRENCY;
}

export const ZERO_HOOKS = NATIVE_CURRENCY;

/**
 * Block just before the V4 mainnet deployment (late Jan 2025) — lower bound for
 * scanning PositionManager Transfer logs when enumerating a wallet's positions.
 */
export const V4_DEPLOY_BLOCK = 21_680_000n;

/** A V4 pool's identity — poolId = keccak256(abi.encode(PoolKey)). */
export interface PoolKey {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  /** LP fee in hundredths of a bip; 0x800000 flag = dynamic (hooked) fee. */
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
}
