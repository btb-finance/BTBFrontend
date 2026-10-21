import { encodeFunctionData, parseAbi, type PublicClient } from 'viem';

/**
 * Aero (the Aerodrome and Velodrome merger, live 2026-10-21) voting: a holder points their staked AERO (sAERO, an
 * NFT in VotingEscrow) at pools, at most once per cooldown, and earns those pools' fees and incentives. This module
 * reads a wallet's stakes and builds the allocate call for gauges on the root chain (Base), which needs no bridge fee
 * and no destination gas. Source: github.com/Dromos-Labs/metadex-public (V3/src/interfaces/voter, core).
 *
 * A stake's voting power is booked per chain. New and unallocated power sits on CHAIN0 (id 0), an idle sink that
 * earns nothing; VotingEscrow books it there on every deposit. `allocate` moves a delta from CHAIN0 onto a chain and,
 * in the same call, splits that chain's whole budget across gauges.
 */

export const CHAIN0 = 0n;

export interface AeroDeployment {
  votingEscrow: `0x${string}`;
  /** Root Voter: allocate, chain budgets. */
  voter: `0x${string}`;
  /** This chain's leaf voter: gauge weights, a stake's current split, cooldown. */
  leafVoter: `0x${string}`;
  /** Normal-pool factories (volatile and stable) and the concentrated-liquidity factory. */
  poolFactories: `0x${string}`[];
  clFactory: `0x${string}`;
  gaugeFactory: `0x${string}`;
  clGaugeFactory: `0x${string}`;
}

/** Contract addresses per chain. Base's are filled in once Aero publishes them (deployment-addresses/base.json in
 * Dromos-Labs/metadex-public and metadex-slipstream-public); until then the vote page says Aero voting is not live. */
export const AERO: Record<number, AeroDeployment | undefined> = {
  8453: undefined,
};

/** The chain Aero votes are cast from; its gauges need no bridge fee. */
export const AERO_ROOT_CHAIN = 8453;

export const POOL_FACTORY_ABI = parseAbi([
  'function allPools() view returns (address[])',
  'function allPoolsLength() view returns (uint256)',
  'function allPools(uint256 index) view returns (address)',
  'function defaultFee() view returns (uint256)',
]);
export const GAUGE_FACTORY_ABI = parseAbi([
  'function computeGaugeAddress(address pool) view returns (address)',
  'function isGauge(address gauge) view returns (bool)',
]);
export const POOL_ABI = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
]);
export const GAUGE_STATES_ABI = parseAbi([
  'struct Point { int128 bias; int128 slope; uint48 ts; uint128 permanentStakeBalance; }',
  'function gaugeStates(address gauge) view returns (uint128 ceiling, uint128 claimed, uint48 lastSettlement, bool isRegistered, bool isActivated, uint128 surplus, uint256 lastIndex, uint256 lastTimeIndex, Point point)',
]);

/** A gauge's votes now: the decaying part resolved to `nowSec`, plus permanent stakes. */
export function votesNow(point: { bias: bigint; slope: bigint; ts: number; permanentStakeBalance: bigint }, nowSec: number): bigint {
  const decayed = point.bias - point.slope * BigInt(Math.max(0, nowSec - Number(point.ts)));
  return (decayed > 0n ? decayed : 0n) + point.permanentStakeBalance;
}

/** One pool users can vote for, as the hourly job ranks it (convex/aeroVote.ts). */
export interface AeroVotePool {
  pool: `0x${string}`;
  gauge: `0x${string}`;
  pair: string;
  kind: 'cl' | 'volatile' | 'stable';
  /** Swap fee as a fraction (0.0005 = 0.05%). */
  fee: number;
  volume24hUsd: number;
  fees24hUsd: number;
  /** AERO already voted on the gauge, in whole tokens. */
  votes: number;
  /** Yearly fees per AERO of votes, as a percent of the AERO's value; null when the gauge has no votes yet. */
  aprPerVote: number | null;
}

/**
 * Estimated yearly USD a vote of `myVotes` AERO earns on a pool: its share of the pool's fees once added to the
 * votes already there. Adding votes shrinks every voter's share, which this accounts for.
 */
export function yearlyFromVote(p: AeroVotePool, myVotes: number): number {
  if (myVotes <= 0) return 0;
  return p.fees24hUsd * 365 * (myVotes / (p.votes + myVotes));
}

export const VOTING_ESCROW_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function balanceOfNFT(uint256 tokenId) view returns (uint256)',
  'function isAuthorized(address spender, uint256 tokenId) view returns (bool)',
]);

export const VOTER_ABI = parseAbi([
  'struct GaugeAllocation { address gauge; uint128 allocated; bytes data; }',
  'struct ChainAllocationDispatch { uint256 chainId; uint128 delta; uint256 gasLimit; uint256 value; }',
  'struct GaugeAllocationDispatch { uint256 chainId; uint256 gasLimit; uint256 value; GaugeAllocation[] gauges; }',
  'function allocate(uint256 tokenId, ChainAllocationDispatch[] chainDispatches, GaugeAllocationDispatch[] gaugeDispatches, address refundRecipient) payable',
  'function allocationChainAmounts(uint256 tokenId, uint256 chainId) view returns (uint128)',
]);

export const LEAF_VOTER_ABI = parseAbi([
  'function tokenSnapshot(uint256 tokenId) view returns (uint128 staked, uint48 stakeEnd, bool isPermanent)',
  'function allocatedGauges(uint256 tokenId) view returns (address[])',
  'function allocations(uint256 tokenId, address gauge) view returns (uint128)',
  'function allocationCooldown() view returns (uint48)',
  'function maxGauges() view returns (uint256)',
  'function isActivated(address gauge) view returns (bool)',
]);

export interface AeroStake {
  tokenId: bigint;
  /** Unallocated power parked on CHAIN0, free to allocate. */
  idle: bigint;
  /** Power already booked on this chain, split across the gauges below. */
  onChain: bigint;
  gauges: { gauge: `0x${string}`; allocated: bigint }[];
  votingPower: bigint;
}

/** Every sAERO the wallet holds on `chainId`, with its idle power and current gauge split. */
export async function readStakes(client: PublicClient, chainId: number, owner: `0x${string}`): Promise<AeroStake[]> {
  const c = AERO[chainId];
  if (!c) return [];
  const n = await client.readContract({ address: c.votingEscrow, abi: VOTING_ESCROW_ABI, functionName: 'balanceOf', args: [owner] });
  const ids = await Promise.all(Array.from({ length: Number(n) }, (_, i) =>
    client.readContract({ address: c.votingEscrow, abi: VOTING_ESCROW_ABI, functionName: 'tokenOfOwnerByIndex', args: [owner, BigInt(i)] })));
  return Promise.all(ids.map(async (tokenId) => {
    const [idle, onChain, gaugeList, votingPower] = await Promise.all([
      client.readContract({ address: c.voter, abi: VOTER_ABI, functionName: 'allocationChainAmounts', args: [tokenId, CHAIN0] }),
      client.readContract({ address: c.voter, abi: VOTER_ABI, functionName: 'allocationChainAmounts', args: [tokenId, BigInt(chainId)] }),
      client.readContract({ address: c.leafVoter, abi: LEAF_VOTER_ABI, functionName: 'allocatedGauges', args: [tokenId] }),
      client.readContract({ address: c.votingEscrow, abi: VOTING_ESCROW_ABI, functionName: 'balanceOfNFT', args: [tokenId] }),
    ]);
    const gauges = await Promise.all(gaugeList.map(async (gauge) => ({
      gauge, allocated: await client.readContract({ address: c.leafVoter, abi: LEAF_VOTER_ABI, functionName: 'allocations', args: [tokenId, gauge] }),
    })));
    return { tokenId, idle, onChain, gauges, votingPower };
  }));
}

/**
 * The allocate call that puts a stake's whole power on the chosen gauges of the root chain. `shares` are relative
 * weights (any scale); the amounts are worked out here so they add up exactly to the chain's budget, as the Voter
 * requires, with any rounding remainder on the largest share. Gauges left out are cleared. Root-chain entries carry no
 * bridge fee and no destination gas, so the call needs no value.
 */
export function buildAllocate(chainId: number, stake: AeroStake, shares: { gauge: `0x${string}`; weight: number }[], refundTo: `0x${string}`) {
  const c = AERO[chainId];
  if (!c) throw new Error('Aero is not live on this chain yet.');
  const picked = shares.filter((s) => s.weight > 0);
  if (picked.length === 0) throw new Error('Pick at least one pool.');
  const budget = stake.onChain + stake.idle;
  if (budget === 0n) throw new Error('This stake has no voting power to allocate.');
  const total = picked.reduce((a, s) => a + s.weight, 0);
  const amounts = picked.map((s) => ({ gauge: s.gauge, allocated: (budget * BigInt(Math.round((s.weight / total) * 1e6))) / 1_000_000n }));
  const spent = amounts.reduce((a, s) => a + s.allocated, 0n);
  const largest = amounts.reduce((m, s, i) => (s.allocated > amounts[m].allocated ? i : m), 0);
  amounts[largest].allocated += budget - spent;
  // The Voter wants gauges strictly ascending by address.
  amounts.sort((a, b) => (BigInt(a.gauge) < BigInt(b.gauge) ? -1 : 1));
  return {
    to: c.voter,
    data: encodeFunctionData({
      abi: VOTER_ABI, functionName: 'allocate',
      args: [
        stake.tokenId,
        stake.idle > 0n ? [{ chainId: BigInt(chainId), delta: stake.idle, gasLimit: 0n, value: 0n }] : [],
        [{ chainId: BigInt(chainId), gasLimit: 0n, value: 0n, gauges: amounts.map((a) => ({ gauge: a.gauge, allocated: a.allocated, data: '0x' as const })) }],
        refundTo,
      ],
    }),
    value: 0n,
  };
}
