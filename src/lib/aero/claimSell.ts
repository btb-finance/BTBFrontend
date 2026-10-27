/**
 * Claim a sAERO position's rewards, optionally selling them into one token of the user's choice in the same confirmation: the claim lands the tokens
 * in the wallet within its own transaction on Base, so each swap after it can spend them. Wallets that batch (EIP-5792)
 * sign once; others confirm each step in order (runCalls).
 */
import { encodeFunctionData, erc20Abi, parseAbi, type Address, type PublicClient } from 'viem';
import { buildKyberTx, getKyberQuote } from '../kyberswap';
import type { Call } from '../txRunner';
import { AERO_CHAIN_ID, claimCall, type Earned } from './allocator';

export const BASE_USDC: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
/** KyberSwap's address for the chain's own ETH. */
export const NATIVE: Address = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
/** The token rewards are sold into. */
export type SellTarget = { address: Address; symbol: string; decimals: number };
/** Tokens worth less than this are claimed but not sold: the swap would cost more in gas than it brings. */
const MIN_SELL_USD = 2;
/**
 * Slippage for each sale. Wider than a normal swap on purpose: in a one-confirmation batch a single swap that misses its
 * minimum undoes the claim with it, and these are small amounts where 2% is cents.
 */
const SELL_SLIPPAGE_BPS = 200;

export type RewardLine = { token: Address; symbol: string; decimals: number; raw: bigint; amount: number; usd: number | null };

/** Symbol, decimals and USD value for each earned token, from DefiLlama, with the chain filling in what it does not know. */
export async function priceRewards(client: PublicClient, earned: Earned): Promise<RewardLine[]> {
  const tokens = [...earned.byToken.keys()];
  if (tokens.length === 0) return [];
  const res = await fetch(`https://coins.llama.fi/prices/current/${tokens.map((t) => `base:${t}`).join(',')}`, { signal: AbortSignal.timeout(12_000) })
    .then((r) => r.json() as Promise<{ coins?: Record<string, { price?: number; decimals?: number; symbol?: string }> }>)
    .catch(() => ({ coins: {} as Record<string, { price?: number; decimals?: number; symbol?: string }> }));
  const coin = (t: string) => Object.entries(res.coins ?? {}).find(([k]) => k.toLowerCase() === `base:${t}`)?.[1];
  const missing = tokens.filter((t) => coin(t)?.decimals == null || !coin(t)?.symbol);
  const meta = new Map<string, { symbol: string; decimals: number }>();
  if (missing.length) {
    const abi = parseAbi(['function symbol() view returns (string)', 'function decimals() view returns (uint8)']);
    const r = await client.multicall({
      allowFailure: true,
      contracts: missing.flatMap((t) => [{ address: t as Address, abi, functionName: 'symbol' }, { address: t as Address, abi, functionName: 'decimals' }] as const),
    });
    missing.forEach((t, i) => meta.set(t, {
      symbol: r[i * 2].status === 'success' ? String(r[i * 2].result) : t.slice(0, 6),
      decimals: r[i * 2 + 1].status === 'success' ? Number(r[i * 2 + 1].result) : 18,
    }));
  }
  return tokens.map((t) => {
    const c = coin(t);
    const m = meta.get(t);
    const decimals = c?.decimals ?? m?.decimals ?? 18;
    const raw = earned.byToken.get(t) ?? 0n;
    const amount = Number(raw) / 10 ** decimals;
    return { token: t as Address, symbol: c?.symbol ?? m?.symbol ?? t.slice(0, 6), decimals, raw, amount, usd: c?.price ? amount * c.price : null };
  }).sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
}

/**
 * The calls for "claim", or "claim and sell into `target`": the claim, then for every token worth selling an approval
 * and a KyberSwap swap of exactly the amount the claim pays (it pays at least what was read). A token with no route is
 * kept, so one odd reward never blocks the rest.
 */
export async function claimCalls(
  tokenId: bigint,
  earned: Earned,
  lines: RewardLine[],
  owner: Address,
  target: SellTarget | null,
): Promise<{ calls: Call[]; sold: string[]; kept: string[] }> {
  const claim = claimCall(tokenId, earned, owner);
  const calls: Call[] = [{ to: claim.to, data: claim.data, value: 0n, label: 'Claim rewards' }];
  const sold: string[] = [];
  const kept: string[] = [];
  if (!target) return { calls, sold, kept };
  const out = target.address.toLowerCase() === NATIVE.toLowerCase() ? 'ETH' : target.address;
  for (const l of lines) {
    if (l.token.toLowerCase() === target.address.toLowerCase()) continue;
    if (l.usd == null || l.usd < MIN_SELL_USD) { kept.push(l.symbol); continue; }
    try {
      const q = await getKyberQuote(l.token, out, l.raw.toString(), target.decimals, AERO_CHAIN_ID, { chargeBtbFee: true, decimalsIn: l.decimals });
      const tx = await buildKyberTx(q.routeSummary, q.routerAddress, owner, owner, SELL_SLIPPAGE_BPS, AERO_CHAIN_ID);
      calls.push({ to: l.token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [tx.to, l.raw] }), label: `Approve ${l.symbol}` });
      calls.push({ to: tx.to, data: tx.data as `0x${string}`, value: BigInt(tx.value ?? 0), label: `Sell ${l.symbol}` });
      sold.push(l.symbol);
    } catch {
      kept.push(l.symbol);
    }
  }
  return { calls, sold, kept };
}
