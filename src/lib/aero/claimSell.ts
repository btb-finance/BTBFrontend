/**
 * Claim a sAERO position's rewards, optionally selling them into one token of the user's choice in the same confirmation: the claim lands the tokens
 * in the wallet within its own transaction on Base, so each swap after it can spend them. Wallets that batch (EIP-5792)
 * sign once; others confirm each step in order (runCalls).
 */
import { encodeFunctionData, erc20Abi, parseAbi, type Address, type PublicClient } from 'viem';
import { buildKyberTx, getKyberQuote } from '../kyberswap';
import type { Call } from '../txRunner';
import { AERO_CHAIN_ID, AERO_CHAINS, claimCall, type ClaimCost, type Earned } from './allocator';

export const BASE_USDC: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
/** WETH on Base. Aero pays WETH fee rewards out as native ETH, so a WETH reward arrives as ETH (checked on Base, 2026-10-27). */
export const BASE_WETH: Address = '0x4200000000000000000000000000000000000006';
/** KyberSwap's address for the chain's own ETH. */
export const NATIVE: Address = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
/** The token rewards are sold into. */
export type SellTarget = { address: Address; symbol: string; decimals: number };
/** Rewards worth less than this are claimed but not sold. Gas on Base is a fraction of a cent, so only true dust stays. */
const MIN_SELL_USD = 0.1;
/**
 * Slippage for each sale. Wider than a normal swap on purpose: in a one-confirmation batch a single swap that misses its
 * minimum undoes the claim with it, and these are small amounts where 2% is cents.
 */
const SELL_SLIPPAGE_BPS = 200;

export type RewardLine = { chainId: number; token: Address; symbol: string; decimals: number; raw: bigint; amount: number; usd: number | null };

/**
 * Symbol, decimals and USD value for each token earned on one chain (`client` is that chain's), from DefiLlama, with the
 * chain filling in what it does not know.
 */
export async function priceRewards(client: PublicClient, earned: Earned): Promise<RewardLine[]> {
  const tokens = [...earned.byToken.keys()];
  if (tokens.length === 0) return [];
  const slug = AERO_CHAINS.find((c) => c.id === earned.chainId)?.llama ?? 'base';
  const res = await fetch(`https://coins.llama.fi/prices/current/${tokens.map((t) => `${slug}:${t}`).join(',')}`, { signal: AbortSignal.timeout(12_000) })
    .then((r) => r.json() as Promise<{ coins?: Record<string, { price?: number; decimals?: number; symbol?: string }> }>)
    .catch(() => ({ coins: {} as Record<string, { price?: number; decimals?: number; symbol?: string }> }));
  const coin = (t: string) => Object.entries(res.coins ?? {}).find(([k]) => k.toLowerCase() === `${slug}:${t}`)?.[1];
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
    const symbol = t === BASE_WETH.toLowerCase() ? 'ETH' : c?.symbol ?? m?.symbol ?? t.slice(0, 6);
    return { chainId: earned.chainId, token: t as Address, symbol, decimals, raw, amount, usd: c?.price ? amount * c.price : null };
  }).sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
}

/**
 * The calls for "claim", or "claim and sell into `target`": one claim for every chain (other chains' parts carry their
 * message cost), then for every Base token worth selling an approval and a KyberSwap swap of exactly the amount the
 * claim pays (it pays at least what was read). A token with no route is kept, so one odd reward never blocks the rest.
 * Rewards on other chains arrive there minutes later by message, so they cannot be sold in this batch.
 */
export async function claimCalls(
  tokenId: bigint,
  earned: Earned[],
  costs: ClaimCost[],
  lines: RewardLine[],
  owner: Address,
  target: SellTarget | null,
): Promise<{ calls: Call[]; sold: string[]; kept: string[] }> {
  const claim = claimCall(tokenId, earned, owner, costs);
  const calls: Call[] = [{ to: claim.to, data: claim.data, value: claim.value, label: 'Claim rewards' }];
  const sold: string[] = [];
  const kept: string[] = [];
  if (!target) return { calls, sold, kept };
  const toEth = target.address.toLowerCase() === NATIVE.toLowerCase();
  const out = toEth ? 'ETH' : target.address;
  for (const l of lines.filter((x) => x.chainId === AERO_CHAIN_ID)) {
    // A WETH reward is paid as ETH: it is sold as ETH (sent with the swap, no approval), and is already there when the target is ETH.
    const paidAsEth = l.token.toLowerCase() === BASE_WETH.toLowerCase();
    if (paidAsEth ? toEth : l.token.toLowerCase() === target.address.toLowerCase()) continue;
    // A token with no listed price is still quoted: the swap's own dollar value decides.
    if (l.usd != null && l.usd < MIN_SELL_USD) { kept.push(l.symbol); continue; }
    try {
      const q = await getKyberQuote(paidAsEth ? 'ETH' : l.token, out, l.raw.toString(), target.decimals, AERO_CHAIN_ID, { chargeBtbFee: true, decimalsIn: l.decimals });
      if (l.usd == null && !(q.amountOutUsd >= MIN_SELL_USD)) { kept.push(l.symbol); continue; }
      const tx = await buildKyberTx(q.routeSummary, q.routerAddress, owner, owner, SELL_SLIPPAGE_BPS, AERO_CHAIN_ID);
      if (!paidAsEth) calls.push({ to: l.token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [tx.to, l.raw] }), label: `Approve ${l.symbol}` });
      calls.push({ to: tx.to, data: tx.data as `0x${string}`, value: BigInt(tx.value ?? 0), label: `Sell ${paidAsEth ? 'ETH' : l.symbol}` });
      sold.push(l.symbol);
    } catch {
      kept.push(l.symbol);
    }
  }
  return { calls, sold, kept };
}

/**
 * Runs the whole batch as one simulation (eth_simulateV1) and drops any sale that would fail, with its approval, so the
 * claim and the other sales still go through: a Safe or a batching wallet executes all or nothing, and one bad route
 * would otherwise undo everything. The dropped token is kept. When the node cannot simulate, the calls go as built.
 */
export async function dropFailingSales(client: PublicClient, owner: Address, built: { calls: Call[]; sold: string[]; kept: string[] }) {
  let { calls, sold, kept } = built;
  for (let round = 0; round < 3; round++) {
    let results: { status: string }[];
    try {
      results = (await client.simulateCalls({ account: owner, calls: calls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? 0n })) })).results;
    } catch { return { calls, sold, kept }; }
    const bad = results.map((r, i) => (r.status === 'failure' ? i : -1)).filter((i) => i > 0);
    if (results[0]?.status === 'failure') throw new Error('The claim would fail. Refresh and try again.');
    if (bad.length === 0) return { calls, sold, kept };
    const drop = new Set<number>();
    for (const i of bad) {
      drop.add(i);
      if (calls[i - 1]?.label?.startsWith('Approve')) drop.add(i - 1);
      const sym = calls[i].label?.replace(/^Sell /, '');
      if (sym) { sold = sold.filter((x) => x !== sym); kept = [...kept, sym]; }
    }
    calls = calls.filter((_, i) => !drop.has(i));
  }
  return { calls, sold, kept };
}

