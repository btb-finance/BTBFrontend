import { encodeFunctionData, erc20Abi, formatUnits, parseUnits } from 'viem';
import { getChainClient } from '../chainClient';
import { simulate, txOut } from './build';
import { tokenChainId, tokenMeta } from './tokens';

/**
 * Cross-chain swaps for agents: sell any token on one chain and receive any token on another, through LI.FI (the
 * best bridge and DEX route, the same router btb.finance's Swap screen uses, under BTB's integrator name). Built as an
 * exact approval when needed, then the bridge transaction, with the quote and a dry run; bridge_status follows it to
 * the other side.
 */

type Addr = `0x${string}`;
const ZERO = '0x0000000000000000000000000000000000000000';
// Routes can include a swap on each side: 0.5 % was too tight between quoting and signing (see the Swap screen).
const SLIPPAGE = '0.03';

interface LifiQuote {
  tool: string;
  action: { fromToken: { symbol: string; decimals: number }; toToken: { symbol: string; decimals: number } };
  estimate: {
    toAmount: string; toAmountMin: string; approvalAddress: string; executionDuration?: number;
    fromAmountUSD?: string; toAmountUSD?: string; feeCosts?: { name: string; amountUSD?: string }[]; gasCosts?: { amountUSD?: string }[];
  };
  transactionRequest: { to: Addr; data: `0x${string}`; value: string; chainId: number };
}

const usd = (x?: string) => (x ? Math.round(Number(x) * 100) / 100 : null);
const CHAIN_NAMES: Record<number, string> = { 1: 'Ethereum', 8453: 'Base', 56: 'BNB Chain', 42161: 'Arbitrum', 10: 'Optimism', 137: 'Polygon', 130: 'Unichain', 4663: 'Robinhood Chain', 43114: 'Avalanche', 59144: 'Linea' };
export const chainName = (id: number) => CHAIN_NAMES[id] ?? `chain ${id}`;

export async function buildBridge(a: { fromChain: string; toChain: string; tokenIn: string; tokenOut: string; amount: string; wallet: string }) {
  const fromChain = tokenChainId(a.fromChain);
  const toChain = tokenChainId(a.toChain);
  if (!fromChain || !toChain) throw new Error('Unknown chain. Use names like base, ethereum, arbitrum, optimism, polygon, bnb, unichain, robinhood.');
  if (fromChain === toChain) throw new Error('Same chain: use build_swap instead.');
  if (!/^0x[0-9a-fA-F]{40}$/.test(a.wallet)) throw new Error('wallet must be a 0x address.');
  const token = (t: string) => (/^eth$/i.test(t) ? ZERO : /^0x[0-9a-fA-F]{40}$/.test(t) ? t.toLowerCase() : null);
  const tokenIn = token(a.tokenIn);
  const tokenOut = token(a.tokenOut);
  if (!tokenIn || !tokenOut) throw new Error('tokenIn and tokenOut must be "ETH" (the native coin) or token addresses from find_token on their own chains.');
  const wallet = a.wallet as Addr;
  const client = getChainClient(fromChain)!;

  // The amount in base units: "max" sells the whole balance of a token (never the native coin, which also pays gas).
  let raw: bigint;
  let decimals = 18;
  if (tokenIn !== ZERO) decimals = (await tokenMeta(client, fromChain, tokenIn)).decimals;
  if (a.amount === 'max') {
    if (tokenIn === ZERO) throw new Error('"max" is for tokens: the native coin also pays gas, so give an amount.');
    raw = await client.readContract({ address: tokenIn as Addr, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] });
    if (raw === 0n) throw new Error('The wallet holds none of tokenIn on this chain.');
  } else {
    if (!/^\d+(\.\d+)?$/.test(a.amount)) throw new Error('amount must be a plain number of whole units, or "max".');
    raw = parseUnits(a.amount, decimals);
  }

  const fee = Number(process.env.LIFI_FEE ?? 0);
  const params = new URLSearchParams({
    fromChain: String(fromChain), toChain: String(toChain), fromToken: tokenIn, toToken: tokenOut, fromAmount: raw.toString(),
    fromAddress: wallet, toAddress: wallet, slippage: SLIPPAGE, order: 'FASTEST', integrator: process.env.LIFI_INTEGRATOR?.trim() || 'btb-finance',
  });
  if (Number.isFinite(fee) && fee > 0 && fee < 1) params.set('fee', String(fee));
  const r = await fetch(`https://li.quest/v1/quote?${params}`, { signal: AbortSignal.timeout(20_000) });
  const body = await r.json().catch(() => null) as (LifiQuote & { message?: string }) | null;
  if (!r.ok || !body?.transactionRequest) throw new Error(`No bridge route: ${body?.message ?? `HTTP ${r.status}`}. Try another token or a bigger amount.`);
  const q = body;
  const fromSym = q.action.fromToken.symbol;
  const toSym = q.action.toToken.symbol;
  const human = formatUnits(raw, decimals);

  // The exact approval for LI.FI's router, only when the wallet has not given enough already.
  const calls: { to: Addr; data: `0x${string}`; value?: bigint; label: string }[] = [];
  let balanceOk = true;
  if (tokenIn !== ZERO) {
    const [allowance, balance] = await Promise.all([
      client.readContract({ address: tokenIn as Addr, abi: erc20Abi, functionName: 'allowance', args: [wallet, q.estimate.approvalAddress as Addr] }),
      client.readContract({ address: tokenIn as Addr, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] }),
    ]);
    balanceOk = balance >= raw;
    if (allowance < raw) {
      calls.push({ to: tokenIn as Addr, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [q.estimate.approvalAddress as Addr, raw] }), label: `Approve exactly ${human} ${fromSym} for the LI.FI router` });
    }
  } else {
    balanceOk = (await client.getBalance({ address: wallet })) >= raw;
  }
  const out = formatUnits(BigInt(q.estimate.toAmount), q.action.toToken.decimals);
  const min = formatUnits(BigInt(q.estimate.toAmountMin), q.action.toToken.decimals);
  const bridgeCall = { to: q.transactionRequest.to, data: q.transactionRequest.data, value: BigInt(q.transactionRequest.value || '0'), label: `Bridge ${human} ${fromSym} to about ${Number(out).toPrecision(6)} ${toSym} on ${chainName(toChain)} (via ${q.tool})` };
  calls.push(bridgeCall);
  const sim = !balanceOk
    ? { status: 'skipped' as const, reason: `The wallet holds less than ${human} ${fromSym}.` }
    : await simulate(client, wallet, bridgeCall, calls.length > 1 ? 'Runs once the approval in step 1 is confirmed.' : null);

  const inUsd = usd(q.estimate.fromAmountUSD);
  const outUsd = usd(q.estimate.toAmountUSD);
  const fees = (q.estimate.feeCosts ?? []).reduce((s, f) => s + Number(f.amountUSD ?? 0), 0);
  const gas = (q.estimate.gasCosts ?? []).reduce((s, g) => s + Number(g.amountUSD ?? 0), 0);
  const warnings: string[] = [];
  if (inUsd && outUsd && outUsd < inUsd * 0.95) warnings.push(`You receive about $${outUsd} for $${inUsd} sent (${Math.round((1 - outUsd / inUsd) * 100)}% less, after fees and price impact). A bigger amount or another route may lose less.`);
  if (inUsd && gas + fees > inUsd * 0.1) warnings.push(`Fees and gas (about $${usd(String(gas + fees))}) are more than 10% of what you send.`);
  return {
    chainId: fromChain, toChainId: toChain, wallet,
    quote: {
      send: `${human} ${fromSym} on ${chainName(fromChain)}`, receive: `${out} ${toSym}`, receiveAtLeast: `${min} ${toSym}`, onChain: chainName(toChain), route: q.tool,
      sendUsd: inUsd, receiveUsd: outUsd, feesUsd: usd(String(fees)), gasUsd: usd(String(gas)),
      estimatedSeconds: q.estimate.executionDuration ?? null,
    },
    balanceOk, simulation: sim, warnings,
    transactions: txOut(calls, fromChain, wallet),
    notes: [
      'Sign on the source chain; the tokens arrive in the same wallet on the destination chain, usually within the estimated time.',
      'Follow the delivery with bridge_status and the source transaction hash. Quotes go stale in a few minutes: rebuild rather than sign an old one.',
      'Nothing was signed or sent. Not financial advice.',
    ],
  };
}

/** Where a cross-chain transfer is: pending, delivered (with the receiving transaction) or failed. */
export async function bridgeStatus(a: { hash: string; fromChain?: string; toChain?: string }) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(a.hash)) throw new Error('hash must be the source transaction hash.');
  const params = new URLSearchParams({ txHash: a.hash });
  const from = a.fromChain ? tokenChainId(a.fromChain) : null;
  const to = a.toChain ? tokenChainId(a.toChain) : null;
  if (from) params.set('fromChain', String(from));
  if (to) params.set('toChain', String(to));
  const r = await fetch(`https://li.quest/v1/status?${params}`, { signal: AbortSignal.timeout(15_000) });
  const s = await r.json().catch(() => null) as {
    status?: string; substatus?: string; substatusMessage?: string; tool?: string;
    sending?: { txLink?: string; amount?: string; token?: { symbol: string; decimals: number } };
    receiving?: { txHash?: string; txLink?: string; chainId?: number; amount?: string; token?: { symbol: string; decimals: number } };
    message?: string;
  } | null;
  if (!s || s.message) return { hash: a.hash, status: 'NOT_FOUND', note: s?.message ?? 'Not known to the bridge yet: if it was just sent, check again in a minute.' };
  const amt = (x?: { amount?: string; token?: { symbol: string; decimals: number } }) =>
    x?.amount && x.token ? `${formatUnits(BigInt(x.amount), x.token.decimals)} ${x.token.symbol}` : null;
  return {
    hash: a.hash, status: s.status, detail: s.substatusMessage ?? s.substatus ?? null, route: s.tool ?? null,
    sent: amt(s.sending), sourceLink: s.sending?.txLink ?? null,
    received: amt(s.receiving), receivingChainId: s.receiving?.chainId ?? null, receivingTx: s.receiving?.txHash ?? null, receivingLink: s.receiving?.txLink ?? null,
    note: s.status === 'DONE' ? 'Delivered.' : s.status === 'FAILED' ? 'The transfer failed; funds are usually refunded on the source chain. Check detail.' : 'On its way. Check again shortly.',
  };
}
