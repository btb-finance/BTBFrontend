import type { PublicClient } from 'viem';
import { fetchDexTopPools } from './geckoterminal';
import { STABLES, type EarnPool } from './pools';

/**
 * Aero's pools for Discover. Aero (the Aerodrome and Velodrome merger, live 2026-10-22) runs new pools on every
 * network it covers; DeFiLlama and DexPaprika still list only the old Aerodrome and Velodrome ones, while GeckoTerminal
 * indexes Aero per network as "aero-<network>". Each pool's fee APR comes from its 24h volume, its fee (in the pool
 * name) and its TVL. Concentrated or basic is read on chain: only a concentrated pool answers tickSpacing(), and a
 * concentrated pool's fee is its live fee() (Aero's dynamic fee hook moves it; 0.0085% on a pool named 0.02%).
 *
 * The fee APR is what an LP earns unstaked. An LP staked in the pool's gauge earns AERO instead and its fees go to the
 * sAERO holders voting for the pool, so the APR shown is the fees side only.
 */

export const AERO_NETWORKS: { chainId: number; chain: string; gecko: string; dexId: string }[] = [
  { chainId: 8453, chain: 'Base', gecko: 'base', dexId: 'aero-base' },
  { chainId: 10, chain: 'Optimism', gecko: 'optimism', dexId: 'aero-optimism' },
  { chainId: 1, chain: 'Ethereum', gecko: 'eth', dexId: 'aero-ethereum' },
  { chainId: 42161, chain: 'Arbitrum', gecko: 'arbitrum', dexId: 'aero-arbitrum' },
  { chainId: 57073, chain: 'Ink', gecko: 'ink', dexId: 'aero-ink' },
];

/** Pages of 20 per network, best 24h volume first. */
const PAGES = 5;
const MIN_TVL_USD = 10_000;

const POOL_ABI = [
  { name: 'tickSpacing', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'int24' }] },
  { name: 'fee', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
] as const;

/** Every Aero pool worth listing across the networks, as Discover rows. Server side only (paced public API). */
export async function ingestAeroPools(clientFor: (chainId: number) => PublicClient | null): Promise<EarnPool[]> {
  const out: EarnPool[] = [];
  for (const net of AERO_NETWORKS) {
    const rows = [];
    for (let page = 1; page <= PAGES; page++) {
      const batch = await fetchDexTopPools(net.gecko, net.dexId, page).catch(() => []);
      rows.push(...batch);
      if (batch.length < 20) break;
    }
    const listed = rows.filter((r) => r.tvlUsd >= MIN_TVL_USD && r.feePct != null);
    if (listed.length === 0) continue;
    // Concentrated or basic, in one multicall; unread pools are left without a model rather than guessed.
    const client = clientFor(net.chainId);
    const reads = client
      ? await client.multicall({ contracts: listed.flatMap((r) => [
        { address: r.address as `0x${string}`, abi: POOL_ABI, functionName: 'tickSpacing' as const },
        { address: r.address as `0x${string}`, abi: POOL_ABI, functionName: 'fee' as const },
      ]), allowFailure: true }).catch(() => null)
      : null;
    listed.forEach((r, i) => {
      const s = reads?.[2 * i];
      const live = s?.status === 'success' ? reads?.[2 * i + 1] : undefined;
      // fee() is in millionths (85 = 0.0085%); the name's percent is the fallback.
      const feePct = live?.status === 'success' ? Number(live.result) / 10_000 : (r.feePct ?? 0);
      const fee = feePct / 100;
      const apyBase = r.tvlUsd > 0 ? (r.volume24hUsd * fee * 365 / r.tvlUsd) * 100 : 0;
      const symbols = r.name.replace(/\s*[\d.]+%\s*$/, '').split('/').map((s) => s.trim());
      const stable = symbols.length === 2 && symbols.every((x) => STABLES.has(x.toUpperCase()));
      out.push({
        id: r.address,
        project: 'aero',
        dex: 'Aero',
        chain: net.chain,
        chainId: net.chainId,
        pair: symbols.join('-'),
        feeTier: Math.round(feePct * 10_000),
        tvlUsd: r.tvlUsd,
        apy: apyBase,
        apyBase,
        apyReward: 0,
        yieldMode: 'stake-or-fees',
        liquidityModel: s?.status === 'success' ? 'CLMM' : s?.status === 'failure' ? 'AMM' : undefined,
        underlyingTokens: r.tokenAddresses,
        volume24hUsd: r.volume24hUsd,
        fees24hUsd: r.volume24hUsd * fee,
        stablecoin: stable,
        ilRisk: stable ? 'no' : 'yes',
        externalUrl: `https://www.geckoterminal.com/${net.gecko}/pools/${r.address}`,
        source: 'dexscreener',
      });
    });
  }
  return out;
}

/** A pool from before Aero: the old Aerodrome and Velodrome deployments, whose gauges Aero's launch killed. */
export function isOldAero(p: Pick<EarnPool, 'project' | 'dex'>): boolean {
  return /^(aerodrome|velodrome)/i.test(p.project) || /^(aerodrome|velodrome)/i.test(p.dex);
}
