// Auto-rebalance: shared by the Convex actions and the browser, so prices,
// addresses and the encoded wallet setup are identical on both sides.
// No Convex functions live here.
import { encodeAbiParameters, parseAbi } from 'viem';

// ── Prices ──────────────────────────────────────────────────────────────────

/** BTB is priced at this many USD for auto-rebalance charges, for now. */
export const BTB_USD = 0.00003;
/** One position check, in BTB. */
export const CHECK_BTB = 1;
/** What one rebalance costs, in USD, per chain. Charged only when it happens. */
export const REBALANCE_USD: Record<number, number> = { 8453: 0.1, 4663: 0.5 };

/** One rebalance on `chainId`, in whole BTB. */
export function rebalanceBtb(chainId: number): number {
  return Math.round((REBALANCE_USD[chainId] ?? 0) / BTB_USD);
}

/** One auto-compound costs the same as a rebalance, and is charged only when it happens. */
export const compoundBtb = rebalanceBtb;
/**
 * Fees are compounded only once they are worth this many times the compound
 * price, so compounding never costs more than it adds.
 */
export const COMPOUND_MIN_MULTIPLE = 5;
export function compoundMinUsd(chainId: number): number {
  return (REBALANCE_USD[chainId] ?? 0) * COMPOUND_MIN_MULTIPLE;
}
/** At most one compound per position this often. */
export const COMPOUND_COOLDOWN_MS = 6 * 60 * 60_000;

/** How often a position can be checked, in minutes. The owner picks. */
export const CHECK_INTERVALS = [5, 15, 30, 60, 240, 1440] as const;
export type CheckInterval = (typeof CHECK_INTERVALS)[number];
export const DEFAULT_INTERVAL: CheckInterval = 60;

export function intervalLabel(min: number): string {
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${min / 60} h`;
  return `${min / 1440} day`;
}

/** Checks per day at an interval, and what they cost in BTB. */
export function dailyCheckBtb(min: number): number {
  return Math.round((1440 / min) * CHECK_BTB);
}

// ── Contracts (same addresses on Base and Robinhood Chain) ──────────────────

export const V6 = {
  factory: '0xE10280d01F95bC88DA149a224e68debc0721f8E6',
  aerodromeAdapter: '0x9275baf6E1ea3033AD132956e4347D4d25e96BB6',
  uniswapV3Adapter: '0x3801B52d9011901A7fAEf1FDb34C9E2ebdECa715',
  swapAdapter: '0x5A72E43960F4dA336a6459391CDEeD680D4084c8',
} as const;

/** KyberSwap's router: the same on every chain, and listed in the V6 registry with its swap function. */
export const KYBER_ROUTER = '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5';
/** Chains where staked rewards can be sold and compounded: the reward token has an oracle pair with WETH there. */
export const REWARD_COMPOUND_CHAINS = [8453, 4663] as const;
export const AERO_TOKEN = '0x940181a94a35a4569e4529a3cdfb74e38fd98631';
export const UP_REWARD_TOKEN = '0x57c0e45cb534413d1c20a4240955d6bb250bb4f1';
/** The gauge reward token per chain: AERO on Base (Aerodrome), UP on Robinhood Chain. */
export const REWARD_TOKEN: Record<number, { address: string; symbol: string }> = {
  8453: { address: AERO_TOKEN, symbol: 'AERO' },
  4663: { address: UP_REWARD_TOKEN, symbol: 'UP' },
};
/** KyberSwap's name for each chain, and the slippage its routes are built with (the wallet's own floor still applies). */
export const KYBER_CHAIN: Record<number, { slug: string; slippageBps: number }> = {
  8453: { slug: 'base', slippageBps: 100 },
  4663: { slug: 'robinhood', slippageBps: 300 },
};

/** The BTB agent that checks and rebalances. It can only run V6 adapter actions. */
export const REBALANCE_AGENT = '0x29396951d460921Ab7E24df167468D3410013916';

export const AUTO_CHAINS = [8453, 4663] as const;

/** Tokens priced without a lookup when valuing fees: USD stablecoins, and each chain's WETH (priced as ETH). */
export const AUTO_STABLES: Record<number, string[]> = {
  8453: ['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca'], // USDC, USDbC
  4663: ['0x5fc5360d0400a0fd4f2af552add042d716f1d168'], // USDG
};
export const AUTO_WETH: Record<number, string> = {
  8453: '0x4200000000000000000000000000000000000006',
  4663: '0x0bd7d308f8e1639fab988df18a8011f41eacad73',
};
/** The BTB registry, the same on every chain. */
export const V6_REGISTRY = '0xF14D03C30Ae072e1E7c531Ce8e8A2Ed6a7417Eb5';
export const AUTO_CHAIN_NAMES: Record<number, string> = { 8453: 'Base', 4663: 'Robinhood Chain' };

/**
 * Position managers auto-rebalance supports, per chain, and the adapter that
 * speaks each one's format. Must match what the V6 registry lists as targets.
 */
export const AUTO_MANAGERS: Record<number, Record<string, `0x${string}`>> = {
  8453: {
    '0x827922686190790b37229fd06084350e74485b72': V6.aerodromeAdapter, // Aerodrome (old)
    '0xa990c6a764b73bf43cee5bb40339c3322fb9d55f': V6.aerodromeAdapter, // Aerodrome (old, gauge caps)
    '0xe1f8cd9ac4e4a65f54f38a5cdafca44f6dd68b53': V6.aerodromeAdapter, // Aerodrome
    '0x03a520b32c04bf3beef7beb72e919cf822ed34f1': V6.uniswapV3Adapter, // Uniswap V3
  },
  4663: {
    '0x07f44c47743a2f36414a82b9f558ecfcf0eedcef': V6.aerodromeAdapter, // UP
    '0x73991a25c818bf1f1128deaab1492d45638de0d3': V6.uniswapV3Adapter, // Uniswap V3
    '0xa79f5775b0b49e51202c48ddf03f380faa96f641': V6.uniswapV3Adapter, // Giga V3 (a PancakeSwap V3 fork, same position format)
  },
};

/** The adapter for a position, or null when auto-rebalance does not support it. */
export function adapterFor(chainId: number, positionManager: string): `0x${string}` | null {
  return AUTO_MANAGERS[chainId]?.[positionManager.toLowerCase()] ?? null;
}

// ── Wallet setup ────────────────────────────────────────────────────────────

/**
 * The rules the wallet gets for both LP adapters. Robinhood pools are thin,
 * so its mint minimums are looser.
 *  - twapWindow 10 min: the price must stay out of range for a while, so a
 *    quick spike does not trigger a rebalance.
 *  - cooldown 10 min between two rebalances in the same pool.
 *  - maxDeviationTicks: refuse to act while the live price is being pushed
 *    away from the average.
 */
export function lpConfig(chainId: number) {
  return {
    maxSlippageBps: chainId === 4663 ? 300 : 100,
    twapWindow: 10 * 60,
    rebalanceCooldown: 10 * 60,
    maxDeviationTicks: chainId === 4663 ? 500 : 300,
  };
}

const LP_CONFIG_TYPE = [{
  type: 'tuple',
  components: [
    { name: 'maxSlippageBps', type: 'uint16' },
    { name: 'twapWindow', type: 'uint32' },
    { name: 'rebalanceCooldown', type: 'uint32' },
    { name: 'maxDeviationTicks', type: 'uint24' },
  ],
}] as const;

export function encodeLpConfig(chainId: number): `0x${string}` {
  return encodeAbiParameters(LP_CONFIG_TYPE, [lpConfig(chainId)]);
}

/** The agent stays allowed for a year; renewing is one owner transaction. */
export const AGENT_TERM_SECONDS = 365 * 24 * 60 * 60;
export const MAX_ACTIONS_PER_DAY = 48;

/**
 * The swap adapter's rules: used only to sell staking rewards into the
 * position's tokens. Every swap must pay at least the time-weighted price less
 * the slippage limit, between pairs the BTB admin gave an oracle.
 */
export function encodeSwapConfig(chainId: number): `0x${string}` {
  return encodeAbiParameters([{
    type: 'tuple',
    components: [
      { name: 'maxSlippageBps', type: 'uint16' },
      { name: 'twapWindow', type: 'uint32' },
      { name: 'maxSwapsPerDay', type: 'uint8' },
      { name: 'tokens', type: 'address[]' },
    ],
  }], [{ maxSlippageBps: chainId === 4663 ? 300 : 100, twapWindow: 10 * 60, maxSwapsPerDay: 10, tokens: [] }]);
}

/** `Setup` for `factory.createAccount`: the BTB agent, both LP adapters, and the swap adapter for selling rewards. */
export function walletSetup(chainId: number, nowSeconds: number) {
  const config = encodeLpConfig(chainId);
  return {
    agent: REBALANCE_AGENT as `0x${string}`,
    agentExpiresAt: BigInt(nowSeconds + AGENT_TERM_SECONDS),
    maxActionsPerDay: MAX_ACTIONS_PER_DAY,
    adapters: [V6.aerodromeAdapter, V6.uniswapV3Adapter, V6.swapAdapter] as `0x${string}`[],
    configs: [config, config, encodeSwapConfig(chainId)],
  };
}

// ── Adapter actions ─────────────────────────────────────────────────────────

/** Action ids of ConcentratedLiquidityAdapter. */
export const Action = { Open: 0, Rebalance: 1, Compound: 2, Collect: 3, Stake: 4, Unstake: 5, Claim: 6 } as const;

function action(kind: number, args: `0x${string}`): `0x${string}` {
  return encodeAbiParameters([{ type: 'uint8' }, { type: 'bytes' }], [kind, args]);
}

export function compoundParams(positionManager: `0x${string}`, tokenId: bigint, amount0: bigint, amount1: bigint, deadline: bigint): `0x${string}` {
  return action(Action.Compound, encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
    [positionManager, tokenId, amount0, amount1, deadline],
  ));
}

export function collectParams(positionManager: `0x${string}`, tokenId: bigint): `0x${string}` {
  return action(Action.Collect, encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [positionManager, tokenId]));
}

export function rebalanceParams(positionManager: `0x${string}`, tokenId: bigint, deadline: bigint): `0x${string}` {
  return action(Action.Rebalance, encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }], [positionManager, tokenId, deadline]));
}

export function gaugeParams(kind: number, gauge: `0x${string}`, tokenId: bigint): `0x${string}` {
  return action(kind, encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [gauge, tokenId]));
}

// ── ABIs ────────────────────────────────────────────────────────────────────

export const FACTORY_ABI = parseAbi([
  'struct Setup { address agent; uint64 agentExpiresAt; uint16 maxActionsPerDay; address[] adapters; bytes[] configs; }',
  'function createAccount(Setup setup) returns (address)',
  'function accountOf(address owner) view returns (address)',
  'function predictAccount(address owner) view returns (address)',
]);

export const WALLET_ABI = parseAbi([
  'function run(address adapter, bytes params)',
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'function agentExpiry(address agent) view returns (uint64)',
  'function adapterCodeHash(address adapter) view returns (bytes32)',
  'function setAgent(address agent, uint64 expiresAt)',
  'function setAdapter(address adapter, bool enabled, bytes config)',
  'function withdrawNft(address collection, uint256 tokenId)',
  'error NotAllowed(address target)',
  'error NotOperator()',
  'error Paused()',
  'error DailyLimitReached()',
  'error CodeChanged(address adapter)',
]);

/** Errors the adapters raise, so a refused check can say why. */
export const ADAPTER_ERRORS_ABI = parseAbi([
  'error NotAllowed(address target)',
  'error NotHeld(uint256 tokenId)',
  'error InvalidInput()',
  'error CooldownActive()',
  'error PriceUnstable()',
  'error PositionInRange()',
  'error CheckFailed()',
  'error GaugeNotAlive(address gauge)',
  'error StakeTooRecent(uint256 tokenId)',
  'error OracleUnavailable()',
]);
