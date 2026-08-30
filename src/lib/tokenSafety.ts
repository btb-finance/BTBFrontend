/**
 * Token safety lookups for LP decisions — what a liquidity provider should
 * check before depositing into a pool containing a token: holder count,
 * top-10 holder concentration, spam reputation, and (where GoPlus supports
 * the chain) honeypot/tax signals. Every field is optional; a failed lookup
 * degrades to "unknown" rather than a fabricated verdict.
 */

export interface TokenSafety {
  address: string;
  holders?: number;
  /** Share of total supply held by the top 10 holders, 0..1. */
  top10Share?: number;
  /** Explorer reputation flag (e.g. Blockscout's 'spam'). */
  spam?: boolean;
  honeypot?: boolean;
  buyTaxPct?: number;
  sellTaxPct?: number;
}

const CACHE_TTL = 30 * 60_000;
const cache = new Map<string, { at: number; value: TokenSafety }>();

/**
 * `blockscoutBase` is the chain's Blockscout API root (e.g.
 * https://robinhoodchain.blockscout.com/api/v2) — only some chains have one.
 * Chains without Blockscout still get GoPlus data when GoPlus lists them.
 */
export async function fetchTokenSafety(address: string, chainId: number, blockscoutBase?: string): Promise<TokenSafety> {
  const key = `${chainId}:${address.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached && cached.at + CACHE_TTL > Date.now()) return cached.value;
  const out: TokenSafety = { address: address.toLowerCase() };

  await Promise.all([
    (async () => {
      if (!blockscoutBase) return;
      const token = await fetch(`${blockscoutBase}/tokens/${address}`, { signal: AbortSignal.timeout(10_000) });
      if (!token.ok) return;
      const body = await token.json() as { holders?: string; total_supply?: string; reputation?: string };
      if (body.holders) out.holders = Number(body.holders) || undefined;
      if (body.reputation && body.reputation.toLowerCase() === 'spam') out.spam = true;
      // Top-10 holder concentration — the classic rug/sell-pressure signal.
      const holders = await fetch(`${blockscoutBase}/tokens/${address}/holders`, { signal: AbortSignal.timeout(10_000) });
      if (!holders.ok) return;
      const list = await holders.json() as { items?: { value?: string }[] };
      const supply = BigInt(body.total_supply ?? '0');
      const top = (list.items ?? []).slice(0, 10);
      if (supply > 0n && top.length > 0) {
        const held = top.reduce((sum, item) => sum + BigInt(item.value ?? '0'), 0n);
        const share = Number(held * 10_000n / supply) / 10_000;
        if (Number.isFinite(share)) out.top10Share = share;
      }
    })().catch(() => {}),
    (async () => {
      const res = await fetch(`https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;
      const body = await res.json() as {
        result?: Record<string, { is_honeypoted?: number | boolean; buy_tax?: string; sell_tax?: string }> | null;
      };
      const row = body.result?.[address.toLowerCase()];
      if (!row) return;
      if (row.is_honeypoted === 1 || row.is_honeypoted === true) out.honeypot = true;
      const buy = Number(row.buy_tax), sell = Number(row.sell_tax);
      if (Number.isFinite(buy) && buy > 0) out.buyTaxPct = buy * 100;
      if (Number.isFinite(sell) && sell > 0) out.sellTaxPct = sell * 100;
    })().catch(() => {}),
  ]);

  cache.set(key, { at: Date.now(), value: out });
  return out;
}
