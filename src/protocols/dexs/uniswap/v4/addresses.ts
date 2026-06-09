/**
 * Uniswap V4 — Ethereum mainnet (chain 1) canonical deployments.
 *
 * SCAFFOLD ONLY. V4 is a singleton architecture: all pools live in one
 * PoolManager, liquidity is managed via PositionManager using packed "actions"
 * (modifyLiquidities) and Permit2 for token approvals, and reads go through
 * StateView. Execution is intentionally not implemented yet — it needs the
 * action-encoding + Permit2 flow built and tested carefully (own stage).
 *
 * Addresses below should be re-verified against the official Uniswap V4
 * deployments list before any execution code depends on them.
 */
export const UNISWAP_V4 = {
  poolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90' as `0x${string}`,
  positionManager: '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e' as `0x${string}`,
  stateView: '0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227' as `0x${string}`,
  quoter: '0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203' as `0x${string}`,
  /** Canonical Permit2 (same address across chains). */
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`,
} as const;
