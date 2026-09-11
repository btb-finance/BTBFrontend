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
import { SLIPSTREAM_FACTORY_ABI } from '../uniswap/v3/abis';
import type { Call } from '@/lib/txRunner';
import { withSafeMulticall } from '@/lib/safeMulticall';
import type { LiquidityPosition } from '@/protocols/types';

export const PROTOCOL = 'aerodrome-cl';
export const BASE_CHAIN_ID = 8453;
export const BASE_WETH = '0x4200000000000000000000000000000000000006' as const;

/** Slipstream tick spacings; there is no fee tier list, fees live on the pool. */
const SLIPSTREAM_TICK_SPACINGS = [1, 50, 100, 200, 2000] as const;

function slipstreamDeployment(positionManager: `0x${string}`, factory: `0x${string}`): V3Deployment {
  return {
    protocol: 'aerodrome-cl',
    slipstream: true,
    chainId: BASE_CHAIN_ID,
    positionManager,
    factory,
    // Keyed by tickSpacing on Slipstream: a "tier" is its spacing.
    feeTiers: SLIPSTREAM_TICK_SPACINGS,
    tickSpacings: Object.fromEntries(SLIPSTREAM_TICK_SPACINGS.map((s) => [s, s])),
  };
}

export const AERODROME_CL_DEPLOYMENTS: readonly V3Deployment[] = [
  slipstreamDeployment('0x827922686190790b37229fd06084350E74485b72', '0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A'),
  slipstreamDeployment('0xa990C6a764b73BF43cee5Bb40339c3322FB9D55F', '0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a'),
  slipstreamDeployment('0xe1f8cd9AC4e4A65F54f38a5CdAfCA44f6dD68b53', '0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef'),
];

/** The deployment a position was read from — carried on the position itself. */
export function aerodromeDeploymentOf(p: LiquidityPosition): V3Deployment {
  const pm = p.positionManager?.toLowerCase();
  return AERODROME_CL_DEPLOYMENTS.find((d) => d.positionManager.toLowerCase() === pm) ?? AERODROME_CL_DEPLOYMENTS[0];
}

/** Every Slipstream position the wallet holds on Base, across all three managers. */
export async function fetchAerodromePositions(
  client: PublicClient,
  owner: `0x${string}`,
  /** Pre-enumerated tokenIds per manager (Blockscout); omit to enumerate on-chain. */
  knownIds?: Map<string, bigint[]>,
): Promise<LiquidityPosition[]> {
  const results = await Promise.allSettled(AERODROME_CL_DEPLOYMENTS.map((d) => fetchV3Positions(client, owner, d, knownIds?.get(d.positionManager.toLowerCase()))));
  const ok = results.filter((r): r is PromiseFulfilledResult<LiquidityPosition[]> => r.status === 'fulfilled');
  if (ok.length === 0) throw (results[0] as PromiseRejectedResult).reason;
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

const VOTER_ABI = [
  { name: 'isGauge', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
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

const OWNER_OF_ABI = [
  { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
] as const;

/** Every Slipstream NFT the wallet has ever sent away, per position manager —
 * the candidate set for "is it sitting in a gauge?". Blockscout, keyless. */
async function fetchTransferredOutIds(owner: `0x${string}`): Promise<Map<string, bigint[]>> {
  const out = new Map<string, bigint[]>();
  // Sequential on purpose: Blockscout's public tier rate-limits bursts, and
  // three managers × pages fired at once was enough to trip it.
  for (const d of AERODROME_CL_DEPLOYMENTS) {
    const ids = new Set<bigint>();
    let params: Record<string, string> | null = {};
    for (let page = 0; page < 6 && params; page++) {
      const qs = new URLSearchParams({ type: 'ERC-721', filter: 'from', token: d.positionManager, ...params });
      let res = await fetch(`https://base.blockscout.com/api/v2/addresses/${owner}/token-transfers?${qs}`, { signal: AbortSignal.timeout(12_000) });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1_200));
        res = await fetch(`https://base.blockscout.com/api/v2/addresses/${owner}/token-transfers?${qs}`, { signal: AbortSignal.timeout(12_000) });
      }
      if (!res.ok) break;
      const body = await res.json() as {
        items?: { from?: { hash?: string }; total?: { token_id?: string } }[];
        next_page_params?: Record<string, string> | null;
      };
      for (const item of body.items ?? []) {
        if (item.from?.hash?.toLowerCase() !== owner.toLowerCase()) continue;
        const id = item.total?.token_id;
        if (id) ids.add(BigInt(id));
      }
      params = body.next_page_params ?? null;
    }
    out.set(d.positionManager.toLowerCase(), [...ids]);
  }
  return out;
}

/** Positions the wallet has staked in Aerodrome gauges, with claimable AERO. */
export async function fetchStakedAerodromePositions(
  client: PublicClient,
  owner: `0x${string}`,
  /** Extra candidate tokenIds per position manager (e.g. from Krystal). */
  extraIds: Map<string, bigint[]> = new Map(),
): Promise<LiquidityPosition[]> {
  const transferred = await fetchTransferredOutIds(owner).catch(() => new Map<string, bigint[]>());
  const results: LiquidityPosition[] = [];
  await Promise.all(AERODROME_CL_DEPLOYMENTS.map(async (d) => {
    const pm = d.positionManager.toLowerCase();
    const ids = [...new Set([...(transferred.get(pm) ?? []), ...(extraIds.get(pm) ?? [])])];
    if (ids.length === 0) return;
    // Who holds each NFT now? Only gauge-held ones matter.
    const owners = await withSafeMulticall(client).multicall({
      contracts: ids.map((id) => ({ address: d.positionManager, abi: OWNER_OF_ABI, functionName: 'ownerOf' as const, args: [id] as const })),
      allowFailure: true,
    });
    const held = ids.map((id, i) => ({ id, holder: owners[i].status === 'success' ? (owners[i].result as `0x${string}`) : null }))
      .filter((x): x is { id: bigint; holder: `0x${string}` } => !!x.holder && x.holder.toLowerCase() !== owner.toLowerCase());
    if (held.length === 0) return;
    const gaugeChecks = await withSafeMulticall(client).multicall({
      contracts: held.map((x) => ({ address: AERODROME_VOTER, abi: VOTER_ABI, functionName: 'isGauge' as const, args: [x.holder] as const })),
      allowFailure: true,
    });
    const inGauge = held.filter((_, i) => gaugeChecks[i].status === 'success' && gaugeChecks[i].result === true);
    if (inGauge.length === 0) return;
    const staked = await withSafeMulticall(client).multicall({
      contracts: inGauge.flatMap((x) => [
        { address: x.holder, abi: CL_GAUGE_ABI, functionName: 'stakedContains' as const, args: [owner, x.id] as const },
        { address: x.holder, abi: CL_GAUGE_ABI, functionName: 'earned' as const, args: [owner, x.id] as const },
      ]),
      allowFailure: true,
    });
    const mine = inGauge
      .map((x, i) => ({ ...x, isMine: staked[i * 2].status === 'success' && staked[i * 2].result === true, earned: staked[i * 2 + 1].status === 'success' ? (staked[i * 2 + 1].result as bigint) : 0n }))
      .filter((x) => x.isMine);
    if (mine.length === 0) return;
    const positions = await fetchV3Positions(client, owner, d, mine.map((x) => x.id));
    for (const p of positions) {
      const s = mine.find((x) => x.id === p.id);
      if (s) results.push({ ...p, staked: { gauge: s.holder, earned: s.earned, rewardToken: AERO_TOKEN, rewardSymbol: 'AERO' } });
    }
  }));
  return results;
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
