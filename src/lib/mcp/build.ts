import { encodeFunctionData, erc20Abi, formatUnits, parseUnits, toHex, type PublicClient } from 'viem';
import { getChainClient } from '../chainClient';
import { BTB_SWAP_FEE_BPS, KYBER_CHAINS, buildKyberTx, getKyberQuote } from '../kyberswap';
import { mintTarget, type EarnPool } from '../pools';
import { lpSlippageBps, v3DeploymentFor } from '@/protocols/lpChains';
import { buildMint } from '@/protocols/dexs/uniswap/v3/actions';
import { POOL_ABI, SLOT0_HEAD_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { addAmounts, rangeTicks } from '@/protocols/dexs/uniswap/v3/math';
import type { Call } from '@/lib/txRunner';
import { chainIdOf, chainKey, poolKey, poolLink, round2, tokenGrade } from './data';

// Transaction builders for the BTB connector: for agents that hold their own wallet. Each returns UNSIGNED
// transactions, in order, for the caller to sign and send itself. Nothing here signs, sends or holds a key.

type Addr = `0x${string}`;
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const isAddr = (s: string): s is Addr => /^0x[0-9a-fA-F]{40}$/.test(s);
const isNative = (s: string) => /^(eth|bnb|native)$/i.test(s) || s.toLowerCase() === NATIVE;

/** Swap fee on swaps the connector builds, in bps of the output. Same as the app unless BTB_MCP_SWAP_FEE_BPS is set. */
export const MCP_SWAP_FEE_BPS = (() => {
  const n = Number(process.env.BTB_MCP_SWAP_FEE_BPS);
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n) : BTB_SWAP_FEE_BPS;
})();

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1, base: 8453, bnbchain: 56, robinhoodchain: 4663, arc: 5042, arbitrum: 42161, optimism: 10, polygon: 137,
  unichain: 130, avalanche: 43114, linea: 59144, berachain: 80094, ronin: 2020, hyperevm: 999, plasma: 9745,
  etherlink: 42793, monad: 143, megaeth: 4326,
};

/** A chain name, slug or id → chain id, for any chain BTB has an RPC for. */
export function chainIdFor(input: string): number | null {
  const n = Number(input);
  const id = Number.isInteger(n) && n > 0 ? n : CHAIN_IDS[chainKey(input)];
  return id && getChainClient(id) ? id : null;
}

/** A chain name, slug or id → chain id, for the chains KyberSwap routes on. */
export function swapChainId(input: string): number | null {
  const id = chainIdFor(input);
  return id && KYBER_CHAINS[id] ? id : null;
}

export interface TxOut { step: number; label: string; chainId: number; from: Addr; to: Addr; data: `0x${string}`; value: `0x${string}`; gas?: string }

export const txOut = (calls: (Call & { label: string })[], chainId: number, from: Addr): TxOut[] =>
  calls.map((c, i) => ({
    step: i + 1, label: c.label, chainId, from, to: c.to, data: c.data ?? '0x', value: toHex(c.value ?? 0n),
    ...(c.gas ? { gas: c.gas.toString() } : {}),
  }));

async function tokenInfo(client: PublicClient, token: Addr, owner: Addr, spender: Addr) {
  const [decimals, symbol, balance, allowance] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }).catch(() => '?'),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [owner, spender] }),
  ]);
  return { decimals: Number(decimals), symbol: String(symbol), balance, allowance };
}

/** Dry-run the final transaction from the wallet. Only meaningful once every approval it needs is already on-chain. */
export async function simulate(client: PublicClient, from: Addr, tx: Call, blockedBy: string | null) {
  if (blockedBy) return { status: 'skipped' as const, reason: blockedBy };
  try {
    await client.call({ account: from, to: tx.to, data: tx.data, value: tx.value });
    return { status: 'passed' as const };
  } catch (e) {
    const msg = e instanceof Error ? (e as Error & { shortMessage?: string }).shortMessage ?? e.message : String(e);
    return { status: 'reverted' as const, reason: msg.slice(0, 300) };
  }
}

// ---- swap ----

export async function buildSwap(a: {
  chain: string; tokenIn: string; tokenOut: string; amount: string; wallet: Addr; recipient?: Addr; slippageBps?: number;
}) {
  const chainId = swapChainId(a.chain);
  if (!chainId) throw new Error(`Swaps are not available on "${a.chain}". Chains: ${Object.values(KYBER_CHAINS).join(', ')}.`);
  const client = getChainClient(chainId);
  if (!client) throw new Error(`No RPC for chain ${chainId}.`);
  const inNative = isNative(a.tokenIn);
  const outNative = isNative(a.tokenOut);
  if (!inNative && !isAddr(a.tokenIn)) throw new Error('tokenIn must be a token address or "ETH" for the native coin.');
  if (!outNative && !isAddr(a.tokenOut)) throw new Error('tokenOut must be a token address or "ETH" for the native coin.');
  const slippageBps = Math.min(Math.max(a.slippageBps ?? 50, 1), 3000);
  const recipient = a.recipient ?? a.wallet;

  // The router address is only known after the quote; read decimals first, allowance after.
  const decIn = inNative ? 18 : Number(await client.readContract({ address: a.tokenIn as Addr, abi: erc20Abi, functionName: 'decimals' }));
  const decOut = outNative ? 18 : Number(await client.readContract({ address: a.tokenOut as Addr, abi: erc20Abi, functionName: 'decimals' }));
  const amountIn = parseUnits(a.amount, decIn);
  if (amountIn <= 0n) throw new Error('amount must be above zero.');

  const quote = await getKyberQuote(inNative ? 'ETH' : a.tokenIn, outNative ? 'ETH' : a.tokenOut, amountIn.toString(), decOut, chainId,
    { chargeBtbFee: MCP_SWAP_FEE_BPS > 0, feeBps: MCP_SWAP_FEE_BPS, decimalsIn: decIn });
  const built = await buildKyberTx(quote.routeSummary, quote.routerAddress, a.wallet, recipient, slippageBps, chainId);
  const router = built.to;

  const calls: (Call & { label: string })[] = [];
  let balanceOk = true;
  let blockedBy: string | null = null;
  let symbolIn = 'ETH';
  if (inNative) {
    balanceOk = (await client.getBalance({ address: a.wallet })) >= amountIn;
  } else {
    const t = await tokenInfo(client, a.tokenIn as Addr, a.wallet, router);
    symbolIn = t.symbol;
    balanceOk = t.balance >= amountIn;
    if (t.allowance < amountIn) {
      calls.push({ to: a.tokenIn as Addr, data: encodeApprove(router, amountIn), label: `Approve exactly ${a.amount} ${t.symbol} for the KyberSwap router` });
      blockedBy = 'The approval in step 1 must be confirmed first; the swap is checked again when it is sent.';
    }
  }
  const swapCall: Call & { label: string } = {
    to: router, data: built.data as `0x${string}`, value: BigInt(built.value ?? 0), gas: built.gas ? BigInt(built.gas) : undefined,
    label: `Swap ${a.amount} ${symbolIn} on KyberSwap (${quote.route})`,
  };
  calls.push(swapCall);
  const sim = balanceOk ? await simulate(client, a.wallet, swapCall, blockedBy) : { status: 'skipped' as const, reason: 'The wallet does not hold enough of tokenIn.' };
  const [grade, symbolOut] = await Promise.all([
    outNative ? null : tokenGrade(chainId, a.tokenOut),
    outNative ? 'ETH' : client.readContract({ address: a.tokenOut as Addr, abi: erc20Abi, functionName: 'symbol' }).then(String).catch(() => '?'),
  ]);

  return {
    chainId, wallet: a.wallet, recipient,
    quote: {
      amountIn: a.amount, symbolIn, amountOut: quote.amountOutFormatted, symbolOut, amountOutRaw: quote.amountOut, amountOutUsd: round2(quote.amountOutUsd),
      priceImpactPct: round2(quote.priceImpact), gasUsd: round2(quote.gasUsd), route: quote.route, slippageBps,
      btbFeePct: MCP_SWAP_FEE_BPS / 100, btbFeeNote: MCP_SWAP_FEE_BPS > 0
        ? `${MCP_SWAP_FEE_BPS / 100}% of the output goes to BTB and is shared with BTB users every Friday. Already deducted from amountOut.`
        : 'No BTB fee.',
    },
    tokenOutSafety: grade ? { score: grade.score, honeypot: grade.honeypot, flags: grade.flags } : null,
    balanceOk,
    simulation: sim,
    transactions: txOut(calls, chainId, a.wallet),
    expiresInSeconds: 120,
    notes: [
      'Sign and send the transactions in step order from the wallet; wait for each to confirm.',
      'Quotes move: rebuild if more than about two minutes pass before sending.',
      'Nothing was signed or sent. Not financial advice.',
    ],
  };
}

const encodeApprove = (spender: Addr, amount: bigint) => encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, amount] });

// ---- add liquidity ----

export async function buildAddLiquidity(p: EarnPool, a: {
  wallet: Addr; token: string; amount: string; rangePct?: number | null; slippageBps?: number;
}) {
  const target = mintTarget(p);
  const chainId = chainIdOf(p);
  const unsupported = (why: string) => { throw Object.assign(new Error(why), { link: poolLink(p) }); };
  if (!target || !chainId) return unsupported('BTB cannot build a deposit for this pool yet. Use add_liquidity_link to send the user to btb.finance.');
  if (target.v4PoolId) return unsupported('Uniswap V4 deposits are not built by the connector yet. Use add_liquidity_link.');
  const d = target.dex ? v3DeploymentFor(target.dex, chainId) : null;
  if (!d || d.algebra) return unsupported('This DEX is not built by the connector yet. Use add_liquidity_link.');
  const client = getChainClient(chainId);
  if (!client) return unsupported(`No RPC for chain ${chainId}.`);
  const pool = p.id as Addr;
  if (!isAddr(pool)) return unsupported('The pool has no V3-style address.');

  const [token0, token1, slot0, spacingRaw] = await Promise.all([
    client.readContract({ address: pool, abi: POOL_ABI, functionName: 'token0' }),
    client.readContract({ address: pool, abi: POOL_ABI, functionName: 'token1' }),
    client.readContract({ address: pool, abi: SLOT0_HEAD_ABI, functionName: 'slot0' }),
    client.readContract({ address: pool, abi: POOL_ABI, functionName: 'tickSpacing' }),
  ]);
  const [sqrtPriceX96, tick] = slot0 as readonly [bigint, number];
  const spacing = Number(spacingRaw);
  const fee = d.slipstream || d.compactPositions ? 0 : Number(await client.readContract({ address: pool, abi: POOL_ABI, functionName: 'fee' }));

  const pm = d.positionManager;
  const [t0, t1] = await Promise.all([tokenInfo(client, token0, a.wallet, pm), tokenInfo(client, token1, a.wallet, pm)]);
  const want = a.token.trim().toLowerCase();
  const side: 0 | 1 | null = want === token0.toLowerCase() || want === t0.symbol.toLowerCase() ? 0
    : want === token1.toLowerCase() || want === t1.symbol.toLowerCase() ? 1 : null;
  if (side === null) throw new Error(`token must be ${t0.symbol} (${token0}) or ${t1.symbol} (${token1}).`);

  const amountRaw = parseUnits(a.amount, side === 0 ? t0.decimals : t1.decimals);
  if (amountRaw <= 0n) throw new Error('amount must be above zero.');
  const pct = a.rangePct === null ? null : Math.min(Math.max(a.rangePct ?? 5, 0.1), 500);
  const { tickLower, tickUpper } = rangeTicks(tick, spacing, pct);
  const { amount0, amount1 } = addAmounts(sqrtPriceX96, tickLower, tickUpper, side, amountRaw);
  if (amount0 === 0n && amount1 === 0n) throw new Error(`The range is entirely on the other side of the price; deposit the other token instead.`);
  const slippageBps = Math.min(Math.max(a.slippageBps ?? lpSlippageBps(chainId), 1), 3000);

  const calls = buildMint({
    token0, token1, fee, tickLower, tickUpper, amount0Desired: amount0, amount1Desired: amount1,
    slippageBps, recipient: a.wallet, nativeEthSide: null, deployment: d, tickSpacing: spacing, sqrtPriceX96,
  });
  // Drop an approval the wallet has already given; label the rest.
  const labelled: (Call & { label: string })[] = [];
  for (const c of calls) {
    const isApprove = c.to.toLowerCase() !== pm.toLowerCase();
    if (isApprove) {
      const t = c.to.toLowerCase() === token0.toLowerCase() ? { info: t0, need: amount0 } : { info: t1, need: amount1 };
      if (t.info.allowance >= t.need) continue;
      labelled.push({ ...c, label: `Approve exactly ${formatUnits(t.need, t.info.decimals)} ${t.info.symbol} for the ${d.label ?? d.protocol} position manager` });
    } else {
      labelled.push({ ...c, label: `Open the ${p.pair} position (${pct === null ? 'full range' : `±${pct}% range`})` });
    }
  }
  const mint = labelled[labelled.length - 1];
  const short = [t0.balance < amount0 ? t0.symbol : null, t1.balance < amount1 ? t1.symbol : null].filter(Boolean) as string[];
  const blockedBy = labelled.length > 1 ? 'The approvals must be confirmed first; the deposit is checked again when it is sent.' : null;
  const sim = short.length ? { status: 'skipped' as const, reason: `The wallet does not hold enough ${short.join(' and ')}. Swap for it first (build_swap).` }
    : await simulate(client, a.wallet, mint, blockedBy);

  return {
    pool: poolKey(p), pair: p.pair, dex: d.label ?? d.protocol, chainId, wallet: a.wallet,
    deposit: {
      [t0.symbol]: { address: token0, amount: formatUnits(amount0, t0.decimals), walletBalance: formatUnits(t0.balance, t0.decimals) },
      [t1.symbol]: { address: token1, amount: formatUnits(amount1, t1.decimals), walletBalance: formatUnits(t1.balance, t1.decimals) },
    },
    range: { rangePct: pct, tickLower, tickUpper, currentTick: tick, inRangeNow: tick >= tickLower && tick < tickUpper },
    missingTokens: short,
    simulation: sim,
    transactions: txOut(labelled, chainId, a.wallet),
    expiresInSeconds: 1200,
    afterwards: 'The position NFT goes to the wallet. Turn on auto-management (auto_manage_setup) to keep it in range.',
    notes: [
      'Sign and send the transactions in step order from the wallet; wait for each to confirm.',
      'Native ETH is not used: deposit the wrapped token (WETH). The mint deadline is 20 minutes.',
      'Concentrated ranges earn more but leave the range when price moves; impermanent loss applies to non-stable pairs.',
      'Nothing was signed or sent. Not financial advice.',
    ],
  };
}
