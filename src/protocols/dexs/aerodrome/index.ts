/**
 * Aerodrome Slipstream (concentrated liquidity) — Base only.
 *
 * Slipstream is a Uniswap V3 fork with one structural difference: pools are
 * keyed by tickSpacing, not fee. The NonfungiblePositionManager's positions()
 * returns tickSpacing where V3 returns fee, mint() takes tickSpacing (plus a
 * sqrtPriceX96 used only to initialise a fresh pool), and the factory's
 * getPool takes tickSpacing. Fees are a per-pool value read from pool.fee().
 * decreaseLiquidity / collect / increaseLiquidity / burn are byte-identical,
 * so the shared V3 actions work once the deployment is flagged `slipstream`.
 *
 * Aerodrome has shipped three position managers on Base (initial, gauge caps,
 * gauges V3); all three still hold live positions, so every wallet is read
 * against all of them. Addresses from github.com/aerodrome-finance/slipstream,
 * factories confirmed on-chain via NonfungiblePositionManager.factory().
 */
import { encodeFunctionData, type PublicClient } from 'viem';
import type { V3Deployment } from '../uniswap/v3/addresses';
import { fetchV3Positions } from '../uniswap/v3/positions';
import { fetchPoolsForMint, type MintPool } from '../uniswap/v3/pool';
import { SLIPSTREAM_FACTORY_ABI } from '../uniswap/v3/abis';
import type { Call } from '@/lib/txRunner';
import { withSafeMulticall } from '@/lib/safeMulticall';
import type { LiquidityPosition } from '@/protocols/types';

export const PROTOCOL = 'aerodrome-cl';
export const BASE_CHAIN_ID = 8453;
export const BASE_WETH = '0x4200000000000000000000000000000000000006' as const;

/** Slipstream tick spacings; there is no fee tier list, fees live on the pool. */
const SLIPSTREAM_TICK_SPACINGS = [1, 50, 100, 200, 2000] as const;

function slipstreamDeployment(positionManager: `0x${string}`, factory: `0x${string}`, label: string, chainId: number = BASE_CHAIN_ID, spacings: readonly number[] = SLIPSTREAM_TICK_SPACINGS): V3Deployment {
  return {
    protocol: 'aerodrome-cl',
    label,
    slipstream: true,
    chainId,
    positionManager,
    factory,
    // Keyed by tickSpacing on Slipstream: a "tier" is its spacing.
    feeTiers: [...spacings],
    tickSpacings: Object.fromEntries(spacings.map((s) => [s, s])),
  };
}

export const AERODROME_CL_DEPLOYMENTS: readonly V3Deployment[] = [
  slipstreamDeployment('0x827922686190790b37229fd06084350E74485b72', '0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A', 'Aerodrome (old)'),
  slipstreamDeployment('0xa990C6a764b73BF43cee5Bb40339c3322FB9D55F', '0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a', 'Aerodrome (old, gauge caps)'),
  slipstreamDeployment('0xe1f8cd9AC4e4A65F54f38a5CdAfCA44f6dD68b53', '0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef', 'Aerodrome'),
];

/** New positions go to the current (gauges V3) deployment — the one new
 * pools and gauges are created on. */
export const AERODROME_MINT_DEPLOYMENT = AERODROME_CL_DEPLOYMENTS[2];

/** Aerodrome Slipstream on Arc: manager and factory read from a live pool
 * (EURC/USDC); spacings from the factory. No voter yet, so no gauges. */
export const ARC_AERODROME_DEPLOYMENT: V3Deployment = slipstreamDeployment(
  '0xc84bB45D43CD25D02b83B4C085eaA4e08da8f473', '0xb89Df768aF2CFE637ceB352c587Fe8edAf491d03', 'Aerodrome', 5042, [1, 10, 50, 100, 200, 2000]);

/** Slipstream deployments to read and mint on, per chain. */
export function aerodromeDeploymentsFor(chainId: number): readonly V3Deployment[] {
  if (chainId === BASE_CHAIN_ID) return AERODROME_CL_DEPLOYMENTS;
  if (chainId === 5042) return [ARC_AERODROME_DEPLOYMENT];
  return [];
}

/** Slipstream pools for a pair across all three factories, keyed by tick
 * spacing, plus which deployment owns each spacing (the mint must go through
 * that deployment's position manager). A spacing that exists on more than
 * one factory keeps the deepest pool. */
export async function fetchAerodromePoolsForMint(
  client: PublicClient,
  tokenA: `0x${string}`,
  tokenB: `0x${string}`,
  chainId: number = BASE_CHAIN_ID,
): Promise<{ pools: Record<number, MintPool>; deploymentByTier: Record<number, V3Deployment> }> {
  const deployments = aerodromeDeploymentsFor(chainId);
  const results = await Promise.allSettled(deployments.map((d) => fetchPoolsForMint(client, tokenA, tokenB, d)));
  const pools: Record<number, MintPool> = {};
  const deploymentByTier: Record<number, V3Deployment> = {};
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    for (const [tier, pool] of Object.entries(r.value)) {
      const key = Number(tier);
      const current = pools[key];
      if (!current || (!current.exists && pool.exists) || (pool.exists && pool.liquidity > current.liquidity)) {
        pools[key] = pool;
        deploymentByTier[key] = deployments[i];
      }
    }
  });
  if (results.every((r) => r.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason;
  return { pools, deploymentByTier };
}

/** The deployment a position was read from — carried on the position itself. */
export function aerodromeDeploymentOf(p: LiquidityPosition): V3Deployment {
  const pm = p.positionManager?.toLowerCase();
  return [...AERODROME_CL_DEPLOYMENTS, ARC_AERODROME_DEPLOYMENT].find((d) => d.positionManager.toLowerCase() === pm) ?? (p.chainId === 5042 ? ARC_AERODROME_DEPLOYMENT : AERODROME_CL_DEPLOYMENTS[2]);
}

/** Every Slipstream position the wallet holds on Base, across all three managers. */
export async function fetchAerodromePositions(
  client: PublicClient,
  owner: `0x${string}`,
  /** Pre-enumerated tokenIds per manager (Blockscout); omit to enumerate on-chain. */
  knownIds?: Map<string, bigint[]>,
  chainId: number = BASE_CHAIN_ID,
): Promise<LiquidityPosition[]> {
  const deployments = aerodromeDeploymentsFor(chainId);
  const results = await Promise.allSettled(deployments.map((d) => fetchV3Positions(client, owner, d, knownIds?.get(d.positionManager.toLowerCase()))));
  const ok = results.filter((r): r is PromiseFulfilledResult<LiquidityPosition[]> => r.status === 'fulfilled');
  if (ok.length === 0) throw (results[0] as PromiseRejectedResult).reason;
  // Gauges exist on Base only so far.
  if (chainId !== BASE_CHAIN_ID) return ok.flatMap((r) => r.value);
  return withGauges(client, ok.flatMap((r) => r.value)).catch(() => ok.flatMap((r) => r.value));
}

// ── Gauge staking ───────────────────────────────────────────────────────────
// A staked Slipstream position's NFT is held by the pool's CLGauge, so the
// wallet's NPM balance no longer lists it. The gauge keeps a per-depositor
// set (stakedValues / stakedContains) and pays AERO through earned/getReward.
// Fees stop accruing to the NFT while staked (the gauge takes them in
// exchange for emissions); withdraw(tokenId) returns the NFT plus rewards.

export const AERODROME_VOTER = '0x16613524e02ad97eDfeF371bC883F2F5d6C480A5' as const;
export const AERO_TOKEN = '0x940181a94A35A4569E4529A3CDfB74e38FD98631' as const;

export const CL_GAUGE_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] },
  { name: 'getReward', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] },
  { name: 'earned', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'stakedContains', type: 'function', stateMutability: 'view', inputs: [{ name: 'depositor', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'stakedValues', type: 'function', stateMutability: 'view', inputs: [{ name: 'depositor', type: 'address' }], outputs: [{ name: '', type: 'uint256[]' }] },
  { name: 'rewardToken', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
] as const;

const VOTER_GAUGES_ABI = [
  { name: 'gauges', type: 'function', stateMutability: 'view', inputs: [{ name: 'pool', type: 'address' }], outputs: [{ name: '', type: 'address' }] },
] as const;

const NPM_APPROVE_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [] },
] as const;

const ZERO = '0x0000000000000000000000000000000000000000';

/** The gauge for each wallet-held position's pool, so the card can offer
 * Stake. Positions whose pool has no gauge come back unchanged. */
export async function withGauges(client: PublicClient, positions: LiquidityPosition[]): Promise<LiquidityPosition[]> {
  const live = positions.filter((p) => p.liquidity > 0n && p.tickSpacing != null && p.positionManager);
  if (live.length === 0) return positions;
  const pools = await withSafeMulticall(client).multicall({
    contracts: live.map((p) => ({ address: aerodromeDeploymentOf(p).factory, abi: SLIPSTREAM_FACTORY_ABI, functionName: 'getPool' as const, args: [p.token0, p.token1, p.tickSpacing!] as const })),
    allowFailure: true,
  });
  const gauges = await withSafeMulticall(client).multicall({
    contracts: pools.map((r) => ({ address: AERODROME_VOTER, abi: VOTER_GAUGES_ABI, functionName: 'gauges' as const, args: [(r.status === 'success' ? r.result : ZERO) as `0x${string}`] as const })),
    allowFailure: true,
  });
  const gaugeOf = new Map<bigint, `0x${string}`>();
  live.forEach((p, i) => {
    const g = gauges[i];
    if (g.status === 'success' && (g.result as string).toLowerCase() !== ZERO) gaugeOf.set(p.id, g.result as `0x${string}`);
  });
  return positions.map((p) => (gaugeOf.has(p.id) ? { ...p, stakeable: { gauge: gaugeOf.get(p.id)! } } : p));
}

/** Gauge for a pool by key — used to restake a freshly minted position. */
export async function gaugeForPool(client: PublicClient, d: V3Deployment, token0: `0x${string}`, token1: `0x${string}`, tickSpacing: number): Promise<`0x${string}` | null> {
  const pool = await client.readContract({ address: d.factory, abi: SLIPSTREAM_FACTORY_ABI, functionName: 'getPool', args: [token0, token1, tickSpacing] });
  if (pool.toLowerCase() === ZERO) return null;
  const gauge = await client.readContract({ address: AERODROME_VOTER, abi: VOTER_GAUGES_ABI, functionName: 'gauges', args: [pool] });
  return gauge.toLowerCase() === ZERO ? null : gauge;
}

/** Stake: approve the gauge for this NFT, then deposit it. */
export function buildGaugeStake(positionManager: `0x${string}`, gauge: `0x${string}`, tokenId: bigint): Call[] {
  return [
    { to: positionManager, data: encodeFunctionData({ abi: NPM_APPROVE_ABI, functionName: 'approve', args: [gauge, tokenId] }) },
    { to: gauge, data: encodeFunctionData({ abi: CL_GAUGE_ABI, functionName: 'deposit', args: [tokenId] }) },
  ];
}

/** Staked positions when the gauge is already known (Krystal names it):
 * read the NFT state and the claimable AERO directly, no discovery. */
export async function fetchAerodromeStakedByIds(
  client: PublicClient,
  owner: `0x${string}`,
  entries: { id: bigint; gauge: `0x${string}`; manager: `0x${string}` }[],
): Promise<LiquidityPosition[]> {
  const out: LiquidityPosition[] = [];
  const byManager = new Map<string, typeof entries>();
  for (const e of entries) byManager.set(e.manager.toLowerCase(), [...(byManager.get(e.manager.toLowerCase()) ?? []), e]);
  await Promise.all([...byManager].map(async ([pm, list]) => {
    const d = AERODROME_CL_DEPLOYMENTS.find((x) => x.positionManager.toLowerCase() === pm);
    if (!d) return;
    const checks = await withSafeMulticall(client).multicall({
      contracts: list.flatMap((e) => [
        { address: e.gauge, abi: CL_GAUGE_ABI, functionName: 'stakedContains' as const, args: [owner, e.id] as const },
        { address: e.gauge, abi: CL_GAUGE_ABI, functionName: 'earned' as const, args: [owner, e.id] as const },
      ]),
      allowFailure: true,
    });
    const mine = list.filter((_, i) => checks[i * 2].status === 'success' && checks[i * 2].result === true);
    if (mine.length === 0) return;
    const positions = await fetchV3Positions(client, owner, d, mine.map((e) => e.id));
    for (const p of positions) {
      const i = list.findIndex((e) => e.id === p.id);
      const e = list[i];
      const earned = checks[i * 2 + 1]?.status === 'success' ? (checks[i * 2 + 1].result as bigint) : 0n;
      out.push({ ...p, staked: { gauge: e.gauge, earned, rewardToken: AERO_TOKEN, rewardSymbol: 'AERO' } });
    }
  }));
  return out;
}

/** Unstake: the gauge returns the NFT to the wallet and pays earned AERO. */
export function buildGaugeUnstake(pos: LiquidityPosition): Call[] {
  if (!pos.staked) return [];
  return [{ to: pos.staked.gauge, data: encodeFunctionData({ abi: CL_GAUGE_ABI, functionName: 'withdraw', args: [pos.id] }) }];
}

export function buildGaugeClaim(pos: LiquidityPosition): Call[] {
  if (!pos.staked) return [];
  return [{ to: pos.staked.gauge, data: encodeFunctionData({ abi: CL_GAUGE_ABI, functionName: 'getReward', args: [pos.id] }) }];
}
