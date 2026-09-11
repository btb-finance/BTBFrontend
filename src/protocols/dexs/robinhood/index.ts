/**
 * Concentrated liquidity DEXes native to Robinhood Chain (4663), verified
 * on-chain from live pools and their managers:
 *
 * Giga V3: a byte-compatible Uniswap V3 fork (fee-keyed pools, twelve-field
 * position struct, fee-keyed mint). Six tiers including 0.005% and 0.1%.
 *
 * Ramses V3: pools keyed by tick spacing with a per-pool (dynamic) fee, a
 * compact ten-field position struct and a tick-spacing mint. Same
 * decreaseLiquidity, collect, increaseLiquidity and burn as V3.
 */
import type { V3Deployment } from '../uniswap/v3/addresses';

export const ROBINHOOD_CHAIN_ID = 4663;

export const GIGA_V3_DEPLOYMENT: V3Deployment = {
  protocol: 'giga-v3',
  chainId: ROBINHOOD_CHAIN_ID,
  label: 'Giga V3',
  positionManager: '0xA79F5775b0B49E51202c48DDF03F380FaA96f641',
  factory: '0xEce6eCd61177336ea6Fb9b17937AC439D85EE20B',
  feeTiers: [50, 100, 500, 1000, 3000, 10000],
  tickSpacings: { 50: 10, 100: 1, 500: 10, 1000: 20, 3000: 60, 10000: 200 },
};

/** Ramses tick spacings; the "tier" key is the spacing itself. */
const RAMSES_TICK_SPACINGS = [1, 5, 10, 50, 100, 200] as const;

export const RAMSES_V3_DEPLOYMENT: V3Deployment = {
  protocol: 'ramses-v3',
  chainId: ROBINHOOD_CHAIN_ID,
  label: 'Ramses V3',
  slipstream: true,
  compactPositions: true,
  positionManager: '0x2ebd7b85a4e08d5b508b04ba147976c94afe6590',
  factory: '0xE0c4ceb92d08CA985bB70fe0a22fEb121A9854A8',
  feeTiers: RAMSES_TICK_SPACINGS,
  tickSpacings: Object.fromEntries(RAMSES_TICK_SPACINGS.map((s) => [s, s])),
};
