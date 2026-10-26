/**
 * What moves, and its colour, for every drawing in the docs: the value map and each transaction flow use the same
 * colours so a reader learns them once.
 */
export const ASSET = {
  lp: { color: '#22C38E', label: 'LP position' },
  fees: { color: '#7B93FF', label: 'Trading fees' },
  btb: { color: '#F0B43C', label: 'BTB' },
  token: { color: 'rgba(var(--fg-rgb), 0.78)', label: 'Your tokens' },
  points: { color: 'rgba(var(--fg-rgb), 0.55)', label: 'Points, no transfer' },
} as const;

export type Asset = keyof typeof ASSET;
