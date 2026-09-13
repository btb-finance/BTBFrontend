/**
 * LP staking across venues, one interface.
 *
 * Two contract shapes cover every venue the app stakes on:
 *  - ve(3,3) CL gauges (Aerodrome, UP): approve the gauge for the NFT, then
 *    gauge.deposit(tokenId); gauge.withdraw(tokenId) returns it and pays;
 *    gauge.getReward(tokenId) claims; earned(account, tokenId) reads.
 *  - MasterChef V3 farms (Giga): stake by safeTransferFrom(owner, chef,
 *    tokenId) (the chef's onERC721Received registers it); chef.withdraw(tokenId)
 *    returns it; chef.harvest(tokenId, to) claims; pendingReward(tokenId) reads;
 *    chef.balanceOf / tokenOfOwnerByIndex enumerate a wallet's staked ids.
 */
import { encodeFunctionData, type PublicClient } from 'viem';
import type { Call } from '@/lib/txRunner';
import { withSafeMulticall } from '@/lib/safeMulticall';
import type { LiquidityPosition } from './types';
import type { V3Deployment } from './dexs/uniswap/v3/addresses';
import { SLIPSTREAM_FACTORY_ABI, NPM_ABI } from './dexs/uniswap/v3/abis';
import { fetchV3Positions } from './dexs/uniswap/v3/positions';
import { CL_GAUGE_ABI, AERODROME_VOTER, AERO_TOKEN } from './dexs/aerodrome';
import { UP_V3_DEPLOYMENT, UP_VOTER, UP_TOKEN, GIGA_V3_DEPLOYMENT, GIGA_MASTERCHEF, GIGA_TOKEN } from './dexs/robinhood';

export type StakeKind = 'gauge' | 'masterchef';
export interface StakeTarget { kind: StakeKind; contract: `0x${string}`; rewardToken: `0x${string}`; rewardSymbol: string }

const ZERO = '0x0000000000000000000000000000000000000000';

const VOTER_ABI = [
  { name: 'gauges', type: 'function', stateMutability: 'view', inputs: [{ name: 'pool', type: 'address' }], outputs: [{ name: '', type: 'address' }] },
  { name: 'length', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'pools', type: 'function', stateMutability: 'view', inputs: [{ name: 'i', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
] as const;

export const MASTERCHEF_V3_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'tokenOfOwnerByIndex', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'pendingReward', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'v3PoolAddressPid', type: 'function', stateMutability: 'view', inputs: [{ name: 'pool', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'harvest', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'to', type: 'address' }], outputs: [{ name: 'reward', type: 'uint256' }] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] },
] as const;

const NPM_TRANSFER_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [] },
  { name: 'safeTransferFrom', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [] },
] as const;

/** Staking venue for a V3-style deployment, if the app knows one. */
function venueFor(d: V3Deployment): { kind: StakeKind; voter?: `0x${string}`; chef?: `0x${string}`; rewardToken: `0x${string}`; rewardSymbol: string } | null {
  if (d.protocol === 'aerodrome-cl') return { kind: 'gauge', voter: AERODROME_VOTER, rewardToken: AERO_TOKEN, rewardSymbol: 'AERO' };
  if (d.protocol === 'up-v3') return { kind: 'gauge', voter: UP_VOTER, rewardToken: UP_TOKEN, rewardSymbol: 'UP' };
  if (d.protocol === 'giga-v3') return { kind: 'masterchef', chef: GIGA_MASTERCHEF, rewardToken: GIGA_TOKEN, rewardSymbol: 'GIGA' };
  return null;
}

export function stakingSupported(d: V3Deployment): boolean {
  return venueFor(d) !== null;
}

/** Where a freshly minted position on this pool could be staked, if anywhere. */
export async function stakeTargetForPool(client: PublicClient, d: V3Deployment, token0: `0x${string}`, token1: `0x${string}`, tier: number): Promise<StakeTarget | null> {
  const venue = venueFor(d);
  if (!venue) return null;
  const pool = d.slipstream
    ? await client.readContract({ address: d.factory, abi: SLIPSTREAM_FACTORY_ABI, functionName: 'getPool', args: [token0, token1, tier] })
    : await client.readContract({ address: d.factory, abi: [{ name: 'getPool', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }], outputs: [{ type: 'address' }] }] as const, functionName: 'getPool', args: [token0, token1, tier] });
  if (!pool || pool.toLowerCase() === ZERO) return null;
  if (venue.kind === 'gauge') {
    const gauge = await client.readContract({ address: venue.voter!, abi: VOTER_ABI, functionName: 'gauges', args: [pool] });
    return gauge.toLowerCase() === ZERO ? null : { kind: 'gauge', contract: gauge, rewardToken: venue.rewardToken, rewardSymbol: venue.rewardSymbol };
  }
  const pid = await client.readContract({ address: venue.chef!, abi: MASTERCHEF_V3_ABI, functionName: 'v3PoolAddressPid', args: [pool] });
  return pid > 0n ? { kind: 'masterchef', contract: venue.chef!, rewardToken: venue.rewardToken, rewardSymbol: venue.rewardSymbol } : null;
}

/** Annotate wallet-held positions with the staking contract their pool has. */
export async function withStakeTargets(client: PublicClient, d: V3Deployment, positions: LiquidityPosition[]): Promise<LiquidityPosition[]> {
  const venue = venueFor(d);
  const live = positions.filter((p) => p.liquidity > 0n);
  if (!venue || live.length === 0) return positions;
  const pools = await withSafeMulticall(client).multicall({
    contracts: live.map((p) => d.slipstream
      ? { address: d.factory, abi: SLIPSTREAM_FACTORY_ABI, functionName: 'getPool' as const, args: [p.token0, p.token1, p.tickSpacing ?? 0] as const }
      : { address: d.factory, abi: [{ name: 'getPool', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }], outputs: [{ type: 'address' }] }] as const, functionName: 'getPool' as const, args: [p.token0, p.token1, p.fee] as const }),
    allowFailure: true,
  });
  const poolOf = live.map((_, i) => (pools[i].status === 'success' ? (pools[i].result as `0x${string}`) : ZERO) as `0x${string}`);
  let targetOf: (`0x${string}` | null)[];
  if (venue.kind === 'gauge') {
    const gauges = await withSafeMulticall(client).multicall({
      contracts: poolOf.map((pool) => ({ address: venue.voter!, abi: VOTER_ABI, functionName: 'gauges' as const, args: [pool] as const })),
      allowFailure: true,
    });
    targetOf = gauges.map((g) => (g.status === 'success' && (g.result as string).toLowerCase() !== ZERO ? (g.result as `0x${string}`) : null));
  } else {
    const pids = await withSafeMulticall(client).multicall({
      contracts: poolOf.map((pool) => ({ address: venue.chef!, abi: MASTERCHEF_V3_ABI, functionName: 'v3PoolAddressPid' as const, args: [pool] as const })),
      allowFailure: true,
    });
    targetOf = pids.map((r) => (r.status === 'success' && (r.result as bigint) > 0n ? venue.chef! : null));
  }
  const byId = new Map(live.map((p, i) => [p.id, targetOf[i]]));
  return positions.map((p) => {
    const t = byId.get(p.id);
    return t ? { ...p, stakeable: { kind: venue.kind, gauge: t, rewardSymbol: venue.rewardSymbol } } : p;
  });
}

/** Every position the wallet has staked at this venue, with claimable rewards.
 * Gauges: every pool the voter lists, stakedValues(owner) each (one multicall
 * round). MasterChef: the chef enumerates per owner. */
export async function fetchStakedPositions(client: PublicClient, owner: `0x${string}`, d: V3Deployment): Promise<LiquidityPosition[]> {
  const venue = venueFor(d);
  if (!venue) return [];
  let entries: { id: bigint; contract: `0x${string}` }[] = [];
  if (venue.kind === 'gauge') {
    const n = Number(await client.readContract({ address: venue.voter!, abi: VOTER_ABI, functionName: 'length' }));
    if (n === 0) return [];
    const pools = await withSafeMulticall(client).multicall({
      contracts: Array.from({ length: n }, (_, i) => ({ address: venue.voter!, abi: VOTER_ABI, functionName: 'pools' as const, args: [BigInt(i)] as const })),
      allowFailure: true,
    });
    const poolAddrs = pools.flatMap((r) => (r.status === 'success' ? [r.result as `0x${string}`] : []));
    const gauges = await withSafeMulticall(client).multicall({
      contracts: poolAddrs.map((pool) => ({ address: venue.voter!, abi: VOTER_ABI, functionName: 'gauges' as const, args: [pool] as const })),
      allowFailure: true,
    });
    const gaugeAddrs = gauges.flatMap((r) => (r.status === 'success' && (r.result as string).toLowerCase() !== ZERO ? [r.result as `0x${string}`] : []));
    if (gaugeAddrs.length === 0) return [];
    const staked = await withSafeMulticall(client).multicall({
      contracts: gaugeAddrs.map((g) => ({ address: g, abi: CL_GAUGE_ABI, functionName: 'stakedValues' as const, args: [owner] as const })),
      allowFailure: true,
    });
    gaugeAddrs.forEach((g, i) => {
      const r = staked[i];
      if (r.status === 'success') for (const id of r.result as readonly bigint[]) entries.push({ id, contract: g });
    });
  } else {
    const count = Number(await client.readContract({ address: venue.chef!, abi: MASTERCHEF_V3_ABI, functionName: 'balanceOf', args: [owner] }));
    if (count === 0) return [];
    const ids = await withSafeMulticall(client).multicall({
      contracts: Array.from({ length: count }, (_, i) => ({ address: venue.chef!, abi: MASTERCHEF_V3_ABI, functionName: 'tokenOfOwnerByIndex' as const, args: [owner, BigInt(i)] as const })),
      allowFailure: true,
    });
    entries = ids.flatMap((r) => (r.status === 'success' ? [{ id: r.result as bigint, contract: venue.chef! }] : []));
  }
  if (entries.length === 0) return [];
  const earned = await withSafeMulticall(client).multicall({
    contracts: entries.map((e) => venue.kind === 'gauge'
      ? { address: e.contract, abi: CL_GAUGE_ABI, functionName: 'earned' as const, args: [owner, e.id] as const }
      : { address: e.contract, abi: MASTERCHEF_V3_ABI, functionName: 'pendingReward' as const, args: [e.id] as const }),
    allowFailure: true,
  });
  const positions = await fetchV3Positions(client, owner, d, entries.map((e) => e.id));
  return positions.map((p) => {
    const i = entries.findIndex((e) => e.id === p.id);
    const r = earned[i];
    return { ...p, staked: { kind: venue.kind, gauge: entries[i].contract, earned: r?.status === 'success' ? (r.result as bigint) : 0n, rewardToken: venue.rewardToken, rewardSymbol: venue.rewardSymbol } };
  });
}

export function buildStakeCalls(kind: StakeKind, contract: `0x${string}`, positionManager: `0x${string}`, tokenId: bigint, owner: `0x${string}`): Call[] {
  if (kind === 'masterchef') {
    return [{ to: positionManager, data: encodeFunctionData({ abi: NPM_TRANSFER_ABI, functionName: 'safeTransferFrom', args: [owner, contract, tokenId] }) }];
  }
  return [
    { to: positionManager, data: encodeFunctionData({ abi: NPM_TRANSFER_ABI, functionName: 'approve', args: [contract, tokenId] }) },
    { to: contract, data: encodeFunctionData({ abi: CL_GAUGE_ABI, functionName: 'deposit', args: [tokenId] }) },
  ];
}

export function buildUnstakeCalls(pos: LiquidityPosition): Call[] {
  if (!pos.staked) return [];
  if (pos.staked.kind === 'masterchef') return [{ to: pos.staked.gauge, data: encodeFunctionData({ abi: MASTERCHEF_V3_ABI, functionName: 'withdraw', args: [pos.id] }) }];
  return [{ to: pos.staked.gauge, data: encodeFunctionData({ abi: CL_GAUGE_ABI, functionName: 'withdraw', args: [pos.id] }) }];
}

export function buildClaimCalls(pos: LiquidityPosition, owner: `0x${string}`): Call[] {
  if (!pos.staked) return [];
  if (pos.staked.kind === 'masterchef') return [{ to: pos.staked.gauge, data: encodeFunctionData({ abi: MASTERCHEF_V3_ABI, functionName: 'harvest', args: [pos.id, owner] }) }];
  return [{ to: pos.staked.gauge, data: encodeFunctionData({ abi: CL_GAUGE_ABI, functionName: 'getReward', args: [pos.id] }) }];
}

/** Deployments with a staking venue on a chain, for the LP list's staked scan. */
export function stakingDeploymentsFor(chainId: number): V3Deployment[] {
  if (chainId === 4663) return [UP_V3_DEPLOYMENT, GIGA_V3_DEPLOYMENT];
  return [];
}

/** Read the NPM ownerOf as a post-unstake check (shared by rebalance flows). */
export { NPM_ABI as STAKING_NPM_ABI };
