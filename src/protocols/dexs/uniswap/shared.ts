/**
 * Cross-DEX constants and tx helpers — the single source of truth so mint/add/
 * remove/rebalance and the UI can't drift apart. Previously copy-pasted into
 * v3/actions, v4/actions, CreatePosition, RebalanceSheet and LpPositions.
 */

/** Default slippage tolerance for mints/adds/removes/swaps (0.5%). */
export const SLIPPAGE_BPS = 50;
/** ETH held back for gas whenever a native-ETH side is swapped/deposited. */
export const GAS_RESERVE = 5n * 10n ** 15n; // 0.005 ETH
/** Transaction deadline window. */
const DEADLINE_SECONDS = 1200; // 20 minutes

/** Unix-seconds deadline `DEADLINE_SECONDS` from now. */
export function deadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
}

/** Apply a downward slippage tolerance (bps) to a minimum-out amount. */
export function minOut(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(10_000 - slippageBps)) / 10_000n;
}

/** Apply an upward slippage tolerance (bps) to a maximum-in amount. */
export function maxIn(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(10_000 + slippageBps)) / 10_000n;
}

/** Price of token0 in token1 (human units) at a tick. */
export function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  return 1.0001 ** tick * 10 ** (decimals0 - decimals1);
}
