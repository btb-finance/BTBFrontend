/**
 * Uniswap's governance-controlled "fee switch" — when active for a pool, a
 * slice of every swap fee goes to the protocol instead of LPs. Rolled out
 * pool-by-pool since the 2023 governance vote, at these fixed splits per
 * version/fee-tier (the DAO doesn't pick arbitrary values). V4 currently has
 * no protocol fee at all — LPs keep the full swap fee.
 *
 * We can't cheaply tell whether the switch is ON for one specific pool
 * on-chain here, so this shows the split *if* it's active for that tier —
 * clearly labelled as such — rather than a guaranteed live reading.
 */
export interface FeeSplit {
  /** % of the total swap fee that goes to LPs. */
  lpPct: number;
  /** % of the total swap fee taken by the protocol. */
  protocolPct: number;
}

const V2_SPLIT: FeeSplit = { lpPct: (0.25 / 0.30) * 100, protocolPct: (0.05 / 0.30) * 100 };

const V3_SPLITS: Record<number, FeeSplit> = {
  100:   { lpPct: 75,    protocolPct: 25 },
  500:   { lpPct: 75,    protocolPct: 25 },
  3000:  { lpPct: 83.33, protocolPct: 16.67 },
  10000: { lpPct: 83.34, protocolPct: 16.66 },
};

const V4_SPLIT: FeeSplit = { lpPct: 100, protocolPct: 0 };

export type FeeSwitchProtocol = 'uniswap-v2' | 'uniswap-v3' | 'uniswap-v4' | 'pancakeswap-v3';

/**
 * Returns the fee split for a pool, or null when we don't have a governance
 * schedule for it (e.g. PancakeSwap runs its own fork economics, not
 * Uniswap's fee switch).
 */
export function getFeeSplit(protocol: FeeSwitchProtocol, feeTier?: number): FeeSplit | null {
  if (protocol === 'uniswap-v4') return V4_SPLIT;
  if (protocol === 'uniswap-v2') return V2_SPLIT;
  if (protocol === 'uniswap-v3') return feeTier != null ? (V3_SPLITS[feeTier] ?? null) : null;
  return null; // pancakeswap-v3 — different fee economics, not Uniswap's switch
}
