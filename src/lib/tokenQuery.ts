/**
 * Search-box query → one or two tokens.
 *
 * The pool search used to resolve exactly one token, so a pair could only be
 * found by picking both sides in the Simulate UI. `searchMarketPools` and
 * `enrichMarketPools` have always accepted a second token — this is what fills
 * it in from what someone types.
 *
 * Accepted shapes, in the order they are tried:
 *   "usdc"                  one token (exact symbol or address)
 *   "eth/usdc"  "eth usdc"  "eth-usdc"  "eth,usdc"   explicit pair
 *   "ethusdc"   "ethusd"    concatenated pair
 *
 * An exactly-named token always wins over a pair reading, so a real token
 * whose symbol happens to look like two glued symbols is never split.
 */

export interface QueryToken {
  address: string;          // lowercase '0x…' or 'ETH' for the native gas token
  symbol: string;
  chainId?: number;
  usdValue?: number;
  verified?: boolean;
}

export interface ResolvedSide {
  /** The list entry that matched, when there was one. */
  token?: QueryToken;
  /** Address to search with — the matched token's, or a pasted raw address. */
  address: string;
  /** What to show in the UI. */
  label: string;
}

export interface ResolvedPoolQuery {
  a: ResolvedSide;
  b?: ResolvedSide;
}

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;
/** Whitespace, slash and comma always separate; a dash does too, but only
 *  after an exact whole-string match has been ruled out. */
const SEPARATOR_RE = /[\s/,]+|-/;

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/**
 * Lowercase hex addresses (the token list mixes checksummed protocol tokens
 * with lowercase list entries) but leave anything else exactly as stored.
 * The native gas token is the sentinel string 'ETH', and callers compare
 * against it verbatim to swap in the wrapped address — lowercasing it here
 * silently breaks every ETH search.
 */
const normalizeAddress = (address: string) =>
  address.startsWith('0x') || address.startsWith('0X') ? address.toLowerCase() : address;

/** Most useful first: verified, then the one the user actually holds, then the
 *  least surprising symbol. Keeps "usd" landing on USDC rather than a clone. */
function rank(list: QueryToken[]): QueryToken[] {
  return [...list].sort((x, y) =>
    Number(!!y.verified) - Number(!!x.verified)
    || (y.usdValue ?? 0) - (x.usdValue ?? 0)
    || x.symbol.length - y.symbol.length
    || x.symbol.localeCompare(y.symbol));
}

/**
 * Resolve one side of a query.
 *
 * `allowPrefix` is off for a bare single-token query so typing "e" cannot
 * start firing searches for whatever token happens to sort first — that path
 * keeps the exact-match behaviour it has always had. It is on inside a pair,
 * where the intent is unambiguous and "eth usd" should find the USDC pool.
 */
function resolveSide(
  part: string,
  tokens: QueryToken[],
  chainId: number | undefined,
  allowPrefix: boolean,
): ResolvedSide | null {
  if (!part) return null;

  // A pasted address the token list doesn't know is still searchable — the
  // market APIs only need the address itself, not list membership.
  if (ADDRESS_RE.test(part)) {
    const known = tokens.find(t => t.address.toLowerCase() === part);
    return { token: known, address: part, label: known?.symbol ?? shortAddress(part) };
  }

  const onChain = tokens.filter(t => chainId == null || (t.chainId ?? 1) === chainId);
  const exact = onChain.filter(t => t.symbol.toLowerCase() === part);
  const matches = exact.length > 0 || !allowPrefix || part.length < 2
    ? exact
    : onChain.filter(t => t.symbol.toLowerCase().startsWith(part));

  const best = rank(matches)[0];
  return best ? { token: best, address: normalizeAddress(best.address), label: best.symbol } : null;
}

const matchedExactly = (part: string, side: ResolvedSide) =>
  side.token?.symbol.toLowerCase() === part;

/** "ethusdc" → ETH + USDC. Only used once the whole string has failed to name
 *  a token on its own, so it cannot shadow a real symbol. */
function splitConcatenated(
  query: string,
  tokens: QueryToken[],
  chainId: number | undefined,
): ResolvedPoolQuery | null {
  if (query.length < 4 || ADDRESS_RE.test(query)) return null;

  let best: { score: number; pair: ResolvedPoolQuery } | null = null;
  for (let i = 2; i <= query.length - 2; i++) {
    const left = query.slice(0, i);
    const right = query.slice(i);
    const a = resolveSide(left, tokens, chainId, true);
    const b = resolveSide(right, tokens, chainId, true);
    if (!a || !b || a.address === b.address) continue;
    // An exact symbol on a side is far stronger evidence than a prefix, so
    // "ethusdc" splits at ETH|USDC rather than at some prefix that also fits.
    const score = (matchedExactly(left, a) ? 2 : 0) + (matchedExactly(right, b) ? 2 : 0);
    if (!best || score > best.score) best = { score, pair: { a, b } };
  }
  return best?.pair ?? null;
}

export function resolvePoolQuery(
  rawQuery: string,
  tokens: QueryToken[],
  chainId?: number,
): ResolvedPoolQuery | null {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!query) return null;

  // 1. The whole string names one token. Checked first so a symbol containing
  //    a separator, or one that reads like two glued symbols, stays intact.
  const whole = resolveSide(query, tokens, chainId, false);
  if (whole) return { a: whole };

  // 2. An explicit pair.
  const parts = query.split(SEPARATOR_RE).filter(Boolean);
  if (parts.length >= 2) {
    const a = resolveSide(parts[0], tokens, chainId, true);
    const b = resolveSide(parts[1], tokens, chainId, true);
    if (a && b && a.address !== b.address) return { a, b };
    // Half-typed ("eth/zzz") still searches the side that resolved.
    if (a) return { a };
  }
  // A trailing separator mid-typing ("eth /") leaves one part. Keep showing
  // that token's pools rather than blanking the results between keystrokes.
  if (parts.length === 1 && parts[0] !== query) {
    const a = resolveSide(parts[0], tokens, chainId, true);
    if (a) return { a };
  }

  // 3. A concatenated pair.
  return splitConcatenated(query, tokens, chainId);
}
