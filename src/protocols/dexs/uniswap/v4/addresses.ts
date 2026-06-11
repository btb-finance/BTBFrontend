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
