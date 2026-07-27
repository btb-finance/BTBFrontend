export const maxDuration = 25;

import { isAddress } from 'viem';
import { ROBINHOOD_QUOTER_V2 } from '@/protocols/dexs/uniswap/v3/addresses';
import { aggregate3, type Call3 } from '@/lib/robinhoodMulticall';

/**
 * Can you actually get back out?
 *
 * Simulates a real round trip against the pool — buy a fixed amount of WETH
 * worth of the token, then immediately sell exactly what you got back. A
 * reverting sell is a honeypot. A round trip that loses materially more than
 * the pool's own fee plus price impact is a taxed token. Both answers come from
 * `eth_call` against the V3 quoter, so nothing is trusted to a vendor.
 *
 * Limits, learned the hard way: the shared Alchemy key is rate limited (HTTP
 * 429 under load) and a quote is far heavier than a balance read, so this is
 * capped per request, cached briefly, and only ever asked for rows the user can
 * actually see. A check that cannot be completed reports `unknown` — never
 * "safe", and never "honeypot".
 */

const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73';
// quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96))
const QUOTE_SELECTOR = 'c6a5026a';
const PROBE_WETH = 5n * 10n ** 15n; // 0.005 WETH — small enough not to move a thin pool
const MAX_POOLS = 12;
const CACHE_TTL_MS = 30_000;
const SAFETY_VARY = { 'Netlify-Vary': 'query=pools' };

export type PoolSafety = {
  token: string;
  status: 'sellable' | 'honeypot' | 'no-liquidity' | 'unknown';
  /** Round-trip loss beyond what the pool's own fee explains, in basis points. */
  taxBps: number | null;
  roundTripBps: number | null;
};

const cache = new Map<string, { at: number; value: PoolSafety }>();

function word(value: string | bigint | number): string {
  if (typeof value === 'string') return value.toLowerCase().replace('0x', '').padStart(64, '0');
  return BigInt(value).toString(16).padStart(64, '0');
}

function quoteCall(tokenIn: string, tokenOut: string, amountIn: bigint, fee: number): Call3 {
  return {
    target: ROBINHOOD_QUOTER_V2,
    callData: `0x${QUOTE_SELECTOR}${word(tokenIn)}${word(tokenOut)}${word(amountIn)}${word(fee)}${word(0)}`,
  };
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('pools') ?? '';
  const requested = raw.split(',').map(entry => {
    const [token, fee] = entry.split(':');
    return { token: token ?? '', fee: Number(fee) || 0 };
  }).filter(item => isAddress(item.token) && item.fee > 0).slice(0, MAX_POOLS);

  if (!requested.length) return Response.json({ safety: [] }, { headers: { ...SAFETY_VARY, 'cache-control': 'no-store' } });

  const now = Date.now();
  const fresh: PoolSafety[] = [];
  const pending: typeof requested = [];
  for (const item of requested) {
    const hit = cache.get(`${item.token.toLowerCase()}:${item.fee}`);
    if (hit && now - hit.at < CACHE_TTL_MS) fresh.push(hit.value);
    else pending.push(item);
  }

  try {
    // Quotes are heavy, so keep each side to one multicall rather than a
    // per-token burst the shared key would rate limit.
    const buys = pending.length ? await aggregate3(pending.map(item => quoteCall(WETH, item.token, PROBE_WETH, item.fee)), 12) : [];

    const sellable: { position: number; bought: bigint }[] = [];
    buys.forEach((result, position) => {
      if (!result.success || result.data === '0x') return;
      try {
        const bought = BigInt(result.data.slice(0, 66));
        if (bought > 0n) sellable.push({ position, bought });
      } catch { /* treated as unquotable below */ }
    });

    const sells = sellable.length
      ? await aggregate3(sellable.map(({ position, bought }) => quoteCall(pending[position].token, WETH, bought, pending[position].fee)), 12)
      : [];
    const sellByPosition = new Map(sellable.map((entry, order) => [entry.position, sells[order]]));

    pending.forEach((item, position) => {
      const bought = sellable.find(entry => entry.position === position)?.bought;
      let value: PoolSafety;
      if (bought === undefined) {
        // Nothing to buy means an empty or uninitialised pool, not a trap.
        value = { token: item.token, status: 'no-liquidity', taxBps: null, roundTripBps: null };
      } else {
        const back = sellByPosition.get(position);
        if (!back?.success || back.data === '0x') {
          value = { token: item.token, status: 'honeypot', taxBps: null, roundTripBps: 0 };
        } else {
          const returned = BigInt(back.data.slice(0, 66));
          const roundTrip = Number(returned) / Number(PROBE_WETH);
          // Two hops each pay the pool fee; anything missing on top of that is
          // the token taking a cut (or a pool too thin to sell back into).
          const feeOnly = (1 - item.fee / 1_000_000) ** 2;
          const extra = Math.max(0, feeOnly - roundTrip);
          value = {
            token: item.token,
            status: 'sellable',
            taxBps: Math.round(extra * 10_000),
            roundTripBps: Math.round(roundTrip * 10_000),
          };
        }
      }
      cache.set(`${item.token.toLowerCase()}:${item.fee}`, { at: now, value });
      fresh.push(value);
    });

    // The map is only a request-scoped cache; drop what has aged out so a long
    // lived server process does not hold every token this chain ever minted.
    if (cache.size > 500) {
      for (const [key, entry] of cache) if (now - entry.at > CACHE_TTL_MS) cache.delete(key);
    }

    return Response.json({ safety: fresh }, { headers: { ...SAFETY_VARY, 'cache-control': 'no-store' } });
  } catch (reason) {
    console.error('[pool-safety]', reason);
    // Rate limited or the node is unreachable — say so, rather than letting a
    // failed check read as a clean bill of health.
    const unknown = pending.map((item): PoolSafety => ({ token: item.token, status: 'unknown', taxBps: null, roundTripBps: null }));
    return Response.json({ safety: [...fresh, ...unknown] }, { headers: { ...SAFETY_VARY, 'cache-control': 'no-store' } });
  }
}
