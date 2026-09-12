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

/** UP (up33.xyz): an Aerodrome Slipstream clone. Pools keyed by tick spacing
 * with a per-pool fee, twelve-field position struct, CL gauges paying UP.
 * Verified from live pools: factory.voter(), pool.gauge(), gauge.rewardToken(). */
const UP_TICK_SPACINGS = [1, 10, 50, 60, 100, 200, 2000] as const;
export const UP_V3_DEPLOYMENT: V3Deployment = {
  protocol: 'up-v3',
  chainId: ROBINHOOD_CHAIN_ID,
  label: 'UP',
  slipstream: true,
  positionManager: '0x07F44c47743A2f36414A82b9F558ECFCf0EEdCEf',
  factory: '0x1ac9dB4a2608ba45D6127B1737949b51Bb54B7F3',
  feeTiers: UP_TICK_SPACINGS,
  tickSpacings: Object.fromEntries(UP_TICK_SPACINGS.map((s) => [s, s])),
};
export const UP_VOTER = '0x7F749fDD351C1Ceed82d76d7699CB631Eb8332a7' as const;
export const UP_TOKEN = '0x57C0E45cB534413D1C20A4240955d6bB250BB4F1' as const;

/** Giga LP staking: a PancakeSwap MasterChef V3 style farm. Positions are
 * staked by transferring the NFT to it, harvested with harvest(tokenId, to),
 * and withdrawn with withdraw(tokenId). Rewards in GIGA. */
export const GIGA_MASTERCHEF = '0x60380925A8b1007F70f60A6A42bffE391374B09a' as const;
export const GIGA_TOKEN = '0x5BaaeC1B70864f01dbdb747358FF59F2E2cCF7D5' as const;

export const GIGA_V3_DEPLOYMENT: V3Deployment = {
  protocol: 'giga-v3',
  chainId: ROBINHOOD_CHAIN_ID,
  label: 'Giga V3',
  positionManager: '0xA79F5775b0B49E51202c48DDF03F380FaA96f641',
  factory: '0xEce6eCd61177336ea6Fb9b17937AC439D85EE20B',
  // Every tier the factory has enabled (feeAmountTickSpacing), read on-chain.
  feeTiers: [50, 100, 200, 500, 1000, 2000, 3000, 10000, 20000],
  tickSpacings: { 50: 10, 100: 1, 200: 4, 500: 10, 1000: 20, 2000: 40, 3000: 60, 10000: 200, 20000: 400 },
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
