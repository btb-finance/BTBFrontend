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

/** Contract addresses per chain. Base's are filled in once Aero publishes them (deployment-addresses/base.json). */
export const AERO: Record<number, { votingEscrow: `0x${string}`; voter: `0x${string}`; leafVoter: `0x${string}` } | undefined> = {
  8453: undefined,
};

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
