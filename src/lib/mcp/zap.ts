import type { EarnPool } from '../pools';
import { buildAddLiquidity, buildSwap, type TxOut } from './build';

/**
 * Add liquidity from one token: swap the right share into the pool's other token, then open the position, built
 * together as one set of steps (one sign link). The split comes from the position's own math for the chosen range
 * and a live swap rate with a margin, so the deposit never needs more of the other token than the swap returns;
 * what is left over (a fraction of the margin) stays in the wallet.
 */

type Addr = `0x${string}`;
type Deposit = Awaited<ReturnType<typeof buildAddLiquidity>>;
type Side = { symbol: string; address: string; amount: string };

/** An amount as a plain decimal string, rounded down to 6 places so it never exceeds what the wallet holds. */
const fmt = (n: number) => (Math.floor(n * 1e6) / 1e6).toFixed(6).replace(/\.?0+$/, '');

/** A margin on the swap rate: covers slippage and the price moving between building and signing. */
const RATE_MARGIN = 0.015;

function sides(d: Deposit): [Side, Side] {
  const [a, b] = Object.entries(d.deposit).map(([symbol, v]) => ({ symbol, address: v.address, amount: v.amount }));
  return [a, b];
}

export async function buildZapLiquidity(p: EarnPool, a: { wallet: Addr; token: string; amount: string; rangePct?: number | null; slippageBps?: number }) {
  // 1. How much of the other token the whole amount would need in this range: the deposit ratio.
  const probe = await buildAddLiquidity(p, { wallet: a.wallet, token: a.token, amount: a.amount, rangePct: a.rangePct, slippageBps: a.slippageBps });
  const [s0, s1] = sides(probe);
  const want = a.token.trim().toLowerCase();
  const mine = want === s0.address.toLowerCase() || want === s0.symbol.toLowerCase() ? s0 : s1;
  const other = mine === s0 ? s1 : s0;
  const total = Number(a.amount);
  const otherPerMine = Number(other.amount) / total;
  if (!(otherPerMine > 0)) {
    // The range sits entirely on this token's side: no swap needed.
    return { ...probe, zap: { swapped: null, note: 'The range only takes this token: deposited as is, no swap.' } };
  }

  // 2. A live rate for the swap, half the amount as a sample, with a margin.
  const sample = await buildSwap({ chain: String(probe.chainId), tokenIn: mine.address, tokenOut: other.address, amount: fmt(total / 2), wallet: a.wallet, slippageBps: a.slippageBps });
  const rate = Number(sample.quote.amountOut.replace(/,/g, '')) / (total / 2) * (1 - RATE_MARGIN);
  if (!(rate > 0)) throw new Error(`No swap route from ${mine.symbol} to ${other.symbol} on this chain.`);

  // 3. Keep x, swap the rest: x · otherPerMine = (total − x) · rate.
  const keep = total * rate / (otherPerMine + rate);
  const swapAmount = total - keep;
  const swap = await buildSwap({ chain: String(probe.chainId), tokenIn: mine.address, tokenOut: other.address, amount: fmt(swapAmount), wallet: a.wallet, slippageBps: a.slippageBps });
  const deposit = await buildAddLiquidity(p, { wallet: a.wallet, token: mine.address, amount: fmt(keep), rangePct: a.rangePct, slippageBps: a.slippageBps });

  // 4. One list of steps: swap (with its approval), then the deposit (with its approvals).
  const transactions: TxOut[] = [...swap.transactions, ...deposit.transactions].map((t, i) => ({ ...t, step: i + 1 }));
  const [d0, d1] = sides(deposit);
  const needOther = Number((d0.address === other.address ? d0 : d1).amount);
  const swapOut = Number(swap.quote.amountOut.replace(/,/g, ''));
  return {
    pool: deposit.pool, pair: deposit.pair, dex: deposit.dex, chainId: deposit.chainId, wallet: a.wallet,
    zap: {
      from: `${a.amount} ${mine.symbol}`,
      swap: `${fmt(swapAmount)} ${mine.symbol} for about ${swap.quote.amountOut} ${other.symbol}`,
      deposit: deposit.deposit,
      leftoverAbout: `${Math.max(0, swapOut - needOther).toPrecision(3)} ${other.symbol} (the safety margin, stays in the wallet)`,
      swapPriceImpactPct: swap.quote.priceImpactPct,
    },
    range: deposit.range,
    // Only the swap can be dry-run now; the deposit needs the swapped tokens first.
    simulation: swap.simulation,
    sims: transactions.map((_, i) => (i === swap.transactions.length - 1 ? swap.simulation : i === transactions.length - 1 ? { status: 'skipped', reason: 'Runs once the swap and approvals before it are confirmed.' } : undefined)),
    warnings: [...((swap as { warnings?: string[] }).warnings ?? [])],
    transactions,
    afterwards: deposit.afterwards,
    notes: ['Sign the steps in order: the swap first, then the approvals and the deposit.', 'Nothing was signed or sent. Not financial advice.'],
  };
}
