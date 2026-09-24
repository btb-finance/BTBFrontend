/**
 * Top up the app BTB balance by paying on the chain the user is already on:
 * ETH or a dollar stablecoin sent straight to the treasury, credited as BTB at
 * the app's fixed BTB price (BTB_USD). No bridge and no swap for the user; the treasury buys
 * BTB later in larger batches. Shared by the app and the Convex checker.
 */

/**
 * Where every payment goes: the BTB Safe, deployed at this address on Ethereum,
 * Base and Robinhood Chain.
 */
export const TOP_UP_TREASURY = '0x98834162FE037a3d213A908162dB5e2dED8cba77';

/** Chains a payment can be made on. */
export const TOP_UP_CHAINS = [8453, 4663, 1] as const;
export const TOP_UP_CHAIN_NAMES: Record<number, string> = { 1: 'Ethereum', 8453: 'Base', 4663: 'Robinhood Chain' };

/** `stable`: counted as dollars. `btb`: BTB itself, credited one for one. Otherwise native ETH at its price. */
export type TopUpAsset = { symbol: string; address: `0x${string}` | null; decimals: number; stable: boolean; btb?: boolean };

/** What each chain accepts. `address: null` is the chain's native ETH. */
export const TOP_UP_ASSETS: Record<number, TopUpAsset[]> = {
  8453: [
    { symbol: 'ETH', address: null, decimals: 18, stable: false },
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, stable: true },
  ],
  4663: [
    { symbol: 'ETH', address: null, decimals: 18, stable: false },
    { symbol: 'USDG', address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', decimals: 6, stable: true },
  ],
  1: [
    { symbol: 'ETH', address: null, decimals: 18, stable: false },
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, stable: true },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, stable: true },
    { symbol: 'BTB', address: '0x88888888c90CD71B35830daBFD24743DbC135B51', decimals: 18, stable: false, btb: true },
  ],
};

/** Smallest payment credited, in USD. */
export const TOP_UP_MIN_USD = 1;
