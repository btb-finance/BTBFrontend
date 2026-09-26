import { encodeFunctionData, parseAbi, type PublicClient } from 'viem';
import type { Call } from '@/lib/txRunner';
import type { LiquidityPosition } from '@/protocols/types';
import { fetchV3Positions } from '@/protocols/dexs/uniswap/v3/positions';
import { AUTO_MANAGERS, autoDeployment, REWARD_TOKEN } from '@/lib/autoRebalance';

/**
 * vfat keeps each user's positions in a Sickle, a per-owner smart wallet (github.com/vfat-io/sickle-public). Its
 * owner can take a staked position out through vfat's NftFarmStrategy.simpleExit: the strategy unstakes it, sends the
 * gauge rewards and the NFT to the owner, and leaves the position's fees inside it. From there the BTB flow moves it
 * into the auto wallet like any other position, so a user can switch without opening vfat.
 *
 * Base only for now: the addresses below were read from a real exit on Base (factory.sickles(owner) returned the
 * owner's Sickle, and the owner's simpleExit went to the strategy).
 */
export const VFAT_BASE = {
  factory: '0x71D234A3e1dfC161cc1d081E6496e76627baAc31',
  nftFarmStrategy: '0x843DdE3302FFD81a793D495A75547741328279e6',
} as const;

const FACTORY_ABI = parseAbi(['function sickles(address owner) view returns (address)']);
const NFT_ABI = parseAbi(['function ownerOf(uint256 tokenId) view returns (address)']);
const GAUGE_ABI = parseAbi(['function stakedContains(address depositor, uint256 tokenId) view returns (bool)']);
const STRATEGY_ABI = [{
  type: 'function', name: 'simpleExit', stateMutability: 'nonpayable', outputs: [],
  inputs: [
    { name: 'position', type: 'tuple', components: [
      { name: 'farm', type: 'tuple', components: [{ name: 'stakingContract', type: 'address' }, { name: 'poolIndex', type: 'uint256' }] },
      { name: 'nft', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ] },
    { name: 'harvestParams', type: 'tuple', components: [
      { name: 'rewardTokens', type: 'address[]' },
      { name: 'amount0Max', type: 'uint128' },
      { name: 'amount1Max', type: 'uint128' },
      { name: 'extraData', type: 'bytes' },
    ] },
    { name: 'withdrawExtraData', type: 'bytes' },
  ],
}] as const;

/** A position in the user's Sickle that BTB auto-rebalance can take over, and the gauge vfat staked it in. */
export type VfatPosition = LiquidityPosition & { sickle: `0x${string}`; vfatGauge: `0x${string}` };

/** The owner's vfat wallet on Base, or null when they never used vfat there. */
export async function findSickle(client: PublicClient, owner: `0x${string}`): Promise<`0x${string}` | null> {
  const sickle = await client.readContract({ address: VFAT_BASE.factory, abi: FACTORY_ABI, functionName: 'sickles', args: [owner] }).catch(() => null);
  return sickle && !/^0x0{40}$/i.test(sickle) ? sickle : null;
}

/**
 * Staked positions in the Sickle on position managers BTB supports. The ids come from the Sickle's NFT history on
 * Blockscout (a Sickle stakes through gauges, so it does not hold them to enumerate); each is then checked on chain:
 * still alive, and staked by this Sickle in the gauge that holds it.
 */
export async function sicklePositions(client: PublicClient, sickle: `0x${string}`): Promise<VfatPosition[]> {
  const supported = new Set(Object.keys(AUTO_MANAGERS[8453] ?? {}));
  type Page = { items?: { token?: { address_hash?: string }; total?: { token_id?: string }; from?: { hash?: string }; to?: { hash?: string } }[]; next_page_params?: Record<string, string | number> | null };
  const items: NonNullable<Page['items']> = [];
  let next: Page['next_page_params'] = null;
  // The history comes in pages of 50; a busy vfat wallet (every rebalance mints a new NFT) needs several.
  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({ type: 'ERC-721', ...(next ? Object.fromEntries(Object.entries(next).map(([k, v]) => [k, String(v)])) : {}) });
    const res = await fetch(`https://base.blockscout.com/api/v2/addresses/${sickle}/token-transfers?${query}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error('Could not read the vfat wallet history');
    const body = (await res.json()) as Page;
    items.push(...(body.items ?? []));
    next = body.next_page_params;
    if (!next) break;
  }
  // Newest first: an NFT's first row is its latest move. Only those whose latest move put them in the Sickle, or took
  // them from it into a gauge, can still be there; burned and exited ones (hundreds, after many rebalances) are skipped
  // without a single chain read.
  const me = sickle.toLowerCase();
  const latest = new Set<string>();
  const seen = new Map<string, { pm: string; id: bigint }>();
  for (const t of items) {
    const pm = t.token?.address_hash?.toLowerCase();
    const id = t.total?.token_id;
    if (!pm || !id || !supported.has(pm)) continue;
    const key = `${pm}:${id}`;
    if (latest.has(key)) continue;
    latest.add(key);
    const from = t.from?.hash?.toLowerCase(), to = t.to?.hash?.toLowerCase();
    const stillThere = to === me || (from === me && !!to && !/^0x0{40}$/.test(to));
    if (stillThere) seen.set(key, { pm, id: BigInt(id) });
  }
  const out: VfatPosition[] = [];
  for (const { pm, id } of seen.values()) {
    const holder = (await client.readContract({ address: pm as `0x${string}`, abi: NFT_ABI, functionName: 'ownerOf', args: [id] }).catch(() => null))?.toLowerCase();
    if (!holder || holder === sickle.toLowerCase()) continue; // burned, or held unstaked (handled on vfat for now)
    const staked = await client.readContract({ address: holder as `0x${string}`, abi: GAUGE_ABI, functionName: 'stakedContains', args: [sickle, id] }).catch(() => false);
    if (!staked) continue;
    const dep = autoDeployment(8453, pm);
    if (!dep) continue;
    const [p] = await fetchV3Positions(client, sickle, dep.deployment, [id]).catch(() => []);
    if (!p || p.liquidity === 0n) continue;
    const reward = REWARD_TOKEN[8453];
    out.push({
      ...p, protocol: dep.protocol, chainId: 8453, chainName: 'Base', positionManager: pm as `0x${string}`,
      staked: { kind: 'gauge', gauge: holder as `0x${string}`, earned: 0n, rewardToken: reward.address as `0x${string}`, rewardSymbol: reward.symbol },
      sickle, vfatGauge: holder as `0x${string}`,
    });
  }
  return out;
}

/** vfat's own exit for one position: unstake, pay the rewards and hand the NFT to the owner. The caller must be the owner. */
export function buildVfatExit(p: VfatPosition): Call {
  return {
    to: VFAT_BASE.nftFarmStrategy,
    label: 'Take it out of vfat',
    data: encodeFunctionData({
      abi: STRATEGY_ABI, functionName: 'simpleExit',
      args: [
        { farm: { stakingContract: p.vfatGauge, poolIndex: 0n }, nft: p.positionManager as `0x${string}`, tokenId: p.id },
        // The same harvest a user's own exit sends: rewards and both tokens swept to them, fees left in the position.
        { rewardTokens: [REWARD_TOKEN[8453].address as `0x${string}`, p.token0, p.token1], amount0Max: 0n, amount1Max: 0n, extraData: '0x' },
        '0x',
      ],
    }),
  };
}
