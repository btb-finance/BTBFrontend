import { erc20Abi, formatUnits, parseUnits, type PublicClient } from 'viem';
import { getChainClient } from '../chainClient';
import { getKyberQuote, KYBER_CHAINS } from '../kyberswap';
import { withSafeMulticall } from '../safeMulticall';
import { chainIdFor } from './build';

/**
 * Tokens for agents: find a token's address on a chain, quote a swap, and list what a wallet holds. Served by the BTB
 * connector (MCP and REST), so any AI app gets the same answers the Ask box does.
 */

type Addr = `0x${string}`;
const BTB = '0x88888888c90cd71b35830dabfd24743dbc135b51';
const NATIVE_SYMBOL: Record<number, string> = { 56: 'BNB', 137: 'POL', 43114: 'AVAX', 80094: 'BERA', 143: 'MON', 999: 'HYPE', 9745: 'XPL', 2020: 'RON' };
const nativeSymbol = (chainId: number) => NATIVE_SYMBOL[chainId] ?? 'ETH';
/** DEX Screener's chain names, for tokens the catalog does not list. */
const DS_CHAIN: Record<number, string> = { 1: 'ethereum', 8453: 'base', 56: 'bsc', 42161: 'arbitrum', 10: 'optimism', 137: 'polygon', 130: 'unichain', 4663: 'robinhood', 43114: 'avalanche', 59144: 'linea' };

export function tokenChainId(chain: string | number): number | null {
  const id = typeof chain === 'number' ? chain : Number(chain) || chainIdFor(String(chain));
  return id && getChainClient(id) ? id : null;
}

// ---- the swap catalog (LI.FI): the same token list the btb.finance Swap screen shows ----

type CatalogToken = { address: string; symbol: string; name: string; decimals: number; priceUsd?: number; verified: boolean };
const catalogs = new Map<number, { at: number; tokens: Promise<CatalogToken[]> }>();

function catalog(chainId: number): Promise<CatalogToken[]> {
  const hit = catalogs.get(chainId);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.tokens;
  const tokens = fetch(`https://li.quest/v1/tokens?chains=${chainId}`, { signal: AbortSignal.timeout(10_000) })
    .then((r) => (r.ok ? r.json() : { tokens: {} }) as Promise<{ tokens?: Record<string, { address?: string; symbol?: string; name?: string; decimals?: number; priceUSD?: string; verificationStatus?: string }[]> }>)
    .then((b) => (b.tokens?.[String(chainId)] ?? []).flatMap((t): CatalogToken[] => {
      if (!t.address || !t.symbol || !Number.isInteger(t.decimals) || t.verificationStatus === 'flagged') return [];
      const p = Number(t.priceUSD);
      return [{ address: t.address.toLowerCase(), symbol: t.symbol, name: t.name ?? t.symbol, decimals: t.decimals!, priceUsd: p > 0 ? p : undefined, verified: t.verificationStatus === 'verified' }];
    }))
    .catch(() => { catalogs.delete(chainId); return [] as CatalogToken[]; });
  catalogs.set(chainId, { at: Date.now(), tokens });
  return tokens;
}

// ---- find_token ----

export async function findToken(query: string, chain: string | number) {
  const q = query.trim().slice(0, 80);
  const chainId = tokenChainId(chain);
  if (!q) throw new Error('query is required.');
  if (!chainId) throw new Error(`Unknown chain "${chain}".`);
  // BTB Finance's own token lives on Ethereum only; other tokens named BTB are not it.
  if (/^btb( finance)?$/i.test(q) || q.toLowerCase() === BTB) {
    if (chainId !== 1) return { chainId, tokens: [], note: 'BTB Finance\'s BTB is only on Ethereum (chain 1). A BTB on this chain is a different token.' };
    return { chainId, tokens: [{ address: BTB, symbol: 'BTB', name: 'BTB Finance', decimals: 18, source: 'btb' }] };
  }
  if (/^(eth|ether|native)$/i.test(q) || q.toLowerCase() === nativeSymbol(chainId).toLowerCase()) {
    return { chainId, tokens: [{ address: 'ETH', symbol: nativeSymbol(chainId), name: 'Native coin', decimals: 18, source: 'native', note: 'Use "ETH" as the token for the native coin in swaps.' }] };
  }
  // 1. The swap catalog, by exact symbol, name or address.
  const lower = q.toLowerCase();
  const list = await catalog(chainId);
  const exact = list.filter((t) => t.address === lower || t.symbol.toLowerCase() === lower || t.name.toLowerCase() === lower)
    .sort((a, b) => Number(b.verified) - Number(a.verified));
  if (exact.length) return withTradeable(chainId, { chainId, tokens: exact.slice(0, 3).map((t) => ({ ...t, source: 'catalog' })) });
  // 2. LI.FI's single lookup (also knows tokens outside the bulk list).
  try {
    const r = await fetch(`https://li.quest/v1/token?chain=${chainId}&token=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(5_000) });
    if (r.ok) {
      const t = await r.json() as { address?: string; symbol?: string; name?: string; decimals?: number; priceUSD?: string; verificationStatus?: string };
      if (t.address && t.verificationStatus !== 'flagged' && !/^0x0{40}$/.test(t.address)) {
        return withTradeable(chainId, { chainId, tokens: [{ address: t.address.toLowerCase(), symbol: t.symbol, name: t.name, decimals: t.decimals, priceUsd: Number(t.priceUSD) || undefined, source: 'lifi' }] });
      }
    }
  } catch { /* next source */ }
  // 3. DEX Screener: anything trading on a DEX, most liquid first.
  const ds = DS_CHAIN[chainId];
  if (ds) {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, { headers: { 'user-agent': 'curl/8.4.0' }, signal: AbortSignal.timeout(6_000) }).catch(() => null);
    if (res?.ok) {
      type Side = { address?: string; symbol?: string; name?: string };
      const d = await res.json() as { pairs?: { chainId?: string; baseToken?: Side; quoteToken?: Side; priceUsd?: string; liquidity?: { usd?: number } }[] };
      const found = new Map<string, { address: string; symbol: string; name: string; liquidityUsd: number; priceUsd?: number }>();
      for (const p of d.pairs ?? []) {
        if (p.chainId !== ds) continue;
        for (const [t, price] of [[p.baseToken, p.priceUsd], [p.quoteToken, undefined]] as [Side | undefined, string | undefined][]) {
          if (!t?.address || !(t.symbol?.toLowerCase() === lower || t.name?.toLowerCase() === lower || t.address.toLowerCase() === lower)) continue;
          const k = t.address.toLowerCase();
          const row = found.get(k) ?? { address: k, symbol: t.symbol ?? '', name: t.name ?? '', liquidityUsd: 0, priceUsd: undefined };
          row.liquidityUsd += p.liquidity?.usd ?? 0;
          row.priceUsd ??= Number(price) || undefined;
          found.set(k, row);
        }
      }
      const rows = [...found.values()].sort((a, b) => b.liquidityUsd - a.liquidityUsd).slice(0, 3)
        .map((r) => ({ ...r, liquidityUsd: Math.round(r.liquidityUsd), source: 'dexscreener' }));
      if (rows.length) return withTradeable(chainId, { chainId, tokens: rows, note: 'Not in the swap catalog: the most liquid match is first; copies with tiny liquidity may be fakes.' });
    }
  }
  return { chainId, tokens: [], note: `No token "${q}" found on chain ${chainId}. Do not guess an address; ask for the contract address.` };
}

/**
 * Marks each match tradeable or not: whether the swap aggregator finds a route selling it for the native coin. Two
 * tokens can share a name and only one trade (Robinhood Chain's two USDGs), so this is checked before anyone quotes.
 */
async function withTradeable<T extends { chainId: number; tokens: { address: string; decimals?: number }[] }>(chainId: number, r: T): Promise<T> {
  if (!KYBER_CHAINS[chainId]) return r;
  const tokens = await Promise.all(r.tokens.map(async (t) => {
    if (!/^0x[0-9a-f]{40}$/i.test(t.address)) return t;
    const ok = await Promise.race([
      getKyberQuote(t.address, 'ETH', (10n ** BigInt(t.decimals ?? 18)).toString(), 18, chainId).then((q) => BigInt(q.amountOut || '0') > 0n).catch(() => false),
      new Promise<null>((done) => setTimeout(() => done(null), 4_000)),
    ]);
    return ok === null ? t : { ...t, tradeable: ok };
  }));
  return { ...r, tokens };
}

// ---- quick_token_check (free) ----

/** A free basic safety check from GoPlus: honeypot, taxes, owner powers. Not as deep as a paid btb.finance scan. */
export async function quickTokenCheck(a: { chain: string | number; token: string }) {
  const chainId = tokenChainId(a.chain);
  if (!chainId) throw new Error(`Unknown chain "${a.chain}".`);
  if (!/^0x[0-9a-fA-F]{40}$/.test(a.token)) throw new Error('token must be a 0x address (find_token gives it).');
  const token = a.token.toLowerCase();
  const r = await fetch(`https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${token}`, { signal: AbortSignal.timeout(10_000) });
  const body = await r.json().catch(() => null) as { code?: number; result?: Record<string, Record<string, unknown>> } | null;
  const x = body?.result?.[token];
  if (!x) return { chainId, token, checked: false, note: 'No free check available for this token or chain. A full scan on btb.finance covers more.', scanLink: `https://btb.finance/scan?token=${token}` };
  const yes = (k: string) => x[k] === '1';
  const pct = (k: string) => (typeof x[k] === 'string' && x[k] !== '' ? Math.round(Number(x[k]) * 10_000) / 100 : null);
  const flags = [
    yes('is_honeypot') && 'honeypot: it cannot be sold',
    yes('cannot_sell_all') && 'cannot sell the whole balance',
    yes('is_mintable') && 'owner can mint more',
    yes('owner_change_balance') && 'owner can change balances',
    yes('hidden_owner') && 'hidden owner',
    yes('is_blacklisted') && 'has a blacklist',
    yes('transfer_pausable') && 'transfers can be paused',
    yes('slippage_modifiable') && 'tax can be changed',
    yes('is_proxy') && 'upgradeable proxy',
    x.is_open_source === '0' && 'source code not verified',
  ].filter(Boolean) as string[];
  const buy = pct('buy_tax'), sell = pct('sell_tax');
  if ((buy ?? 0) > 10 || (sell ?? 0) > 10) flags.push(`high tax (buy ${buy ?? 0}%, sell ${sell ?? 0}%)`);
  return {
    chainId, token, checked: true, source: 'GoPlus (free basic check)',
    symbol: x.token_symbol ?? null, honeypot: yes('is_honeypot'), buyTaxPct: buy, sellTaxPct: sell,
    holders: x.holder_count ? Number(x.holder_count) : null, openSource: x.is_open_source === '1',
    flags, verdict: flags.length === 0 ? 'no red flags in the basic check' : `${flags.length} warning${flags.length > 1 ? 's' : ''}`,
    note: 'Basic and free. token_safety or a btb.finance scan also checks holders, liquidity locks and flows.',
  };
}

// ---- quote_swap ----

export async function tokenMeta(client: PublicClient, chainId: number, token: string): Promise<{ symbol: string; decimals: number; priceUsd?: number }> {
  if (token.toUpperCase() === 'ETH') {
    const eth = (await catalog(chainId)).find((t) => /^0x0{40}$|^0xe{40}$/.test(t.address));
    return { symbol: nativeSymbol(chainId), decimals: 18, priceUsd: eth?.priceUsd };
  }
  const known = (await catalog(chainId)).find((t) => t.address === token.toLowerCase());
  if (known) return known;
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address: token as Addr, abi: erc20Abi, functionName: 'symbol' }).catch(() => token.slice(0, 8)),
    client.readContract({ address: token as Addr, abi: erc20Abi, functionName: 'decimals' }),
  ]);
  return { symbol: String(symbol), decimals: Number(decimals) };
}

const isTokenArg = (t: string) => /^eth$/i.test(t) || /^0x[0-9a-fA-F]{40}$/.test(t);

export async function quoteSwap(a: { chain: string | number; tokenIn: string; tokenOut: string; amount: string }) {
  const chainId = tokenChainId(a.chain);
  if (!chainId || !KYBER_CHAINS[chainId]) throw new Error(`Swaps are not available on "${a.chain}". Chains: ${Object.values(KYBER_CHAINS).join(', ')}.`);
  if (!isTokenArg(a.tokenIn) || !isTokenArg(a.tokenOut)) throw new Error('tokenIn and tokenOut must be "ETH" (the native coin) or a token address from find_token.');
  if (!/^\d+(\.\d+)?$/.test(a.amount)) throw new Error('amount must be a plain number of whole units, e.g. "1" or "0.25".');
  const client = getChainClient(chainId)!;
  const [inM, outM] = await Promise.all([tokenMeta(client, chainId, a.tokenIn), tokenMeta(client, chainId, a.tokenOut)]);
  const q = await getKyberQuote(/^eth$/i.test(a.tokenIn) ? 'ETH' : a.tokenIn, /^eth$/i.test(a.tokenOut) ? 'ETH' : a.tokenOut,
    parseUnits(a.amount, inM.decimals).toString(), outM.decimals, chainId, { chargeBtbFee: true, decimalsIn: inM.decimals });
  const outNum = Number(q.amountOut) / 10 ** outM.decimals;
  const sellUsd = inM.priceUsd ? Number(a.amount) * inM.priceUsd : null;
  const getUsd = outM.priceUsd ? outNum * outM.priceUsd : q.amountOutUsd || null;
  const lossPct = sellUsd && getUsd ? Math.round((1 - getUsd / sellUsd) * 1000) / 10 : null;
  const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);
  return {
    chainId,
    sell: { amount: a.amount, symbol: inM.symbol, usd: r2(sellUsd) },
    get: { amount: q.amountOutFormatted, symbol: outM.symbol, usd: r2(getUsd) },
    rate: `1 ${inM.symbol} = ${q.rate.toLocaleString('en-US', { maximumSignificantDigits: 6 })} ${outM.symbol}`,
    priceUsd: { [inM.symbol]: inM.priceUsd ?? null, [outM.symbol]: outM.priceUsd ?? null },
    priceImpactPct: q.priceImpact,
    gasUsd: r2(q.gasUsd),
    route: q.route,
    ...(lossPct != null && lossPct > 5 ? { warning: `About ${lossPct}% less than the market value of what is sold: the pool is thin for this size. Suggest a smaller amount.` } : {}),
    note: 'After the 1% BTB fee (shared with BTB users every Friday). Quotes move with the market. This is only a price: to swap for a person, call build_swap with their wallet and give them its signLink.',
    swapLink: `https://btb.finance/swap?chain=${chainId}&from=${a.tokenIn}&to=${a.tokenOut}&amount=${a.amount}`,
  };
}

// ---- wallet_tokens ----

/** Chains read by default: where BTB users hold tokens. Any chain can be asked for by name. */
const DEFAULT_CHAINS = [1, 8453, 56, 42161, 10, 137, 130, 4663];
/** Blockscout PRO (BLOCKSCOUT_API_KEY) indexes every token a wallet holds on these, catalog or not. */
const BLOCKSCOUT_PRO = new Set([1, 10, 42161, 4663]);

type Holding = { chainId: number; address: string; symbol: string; name: string; decimals: number; balance: string; usd: number | null; listed: boolean; verified?: boolean };

async function nativeHolding(client: PublicClient, chainId: number, wallet: Addr): Promise<Holding | null> {
  const raw = await client.getBalance({ address: wallet });
  if (raw === 0n) return null;
  const eth = (await catalog(chainId)).find((t) => /^0x0{40}$|^0xe{40}$/.test(t.address));
  const balance = formatUnits(raw, 18);
  return { chainId, address: 'ETH', symbol: nativeSymbol(chainId), name: 'Native coin', decimals: 18, balance, usd: eth?.priceUsd ? Number(balance) * eth.priceUsd : null, listed: true };
}

/**
 * balanceOf for every catalog token: batches of 600 in one multicall each, five at a time. Stops starting batches at
 * the deadline and returns what it has, with `partial` set, so a slow chain never blanks the whole answer.
 */
async function catalogHoldings(client: PublicClient, chainId: number, wallet: Addr, deadline: number, search?: string): Promise<{ holdings: Holding[]; partial: boolean }> {
  // Looking for one token: check only the catalog entries that match it, one quick call.
  const want = search?.trim().toLowerCase();
  const list = (await catalog(chainId)).filter((t) => /^0x[0-9a-f]{40}$/.test(t.address) && !/^0x0{40}$|^0xe{40}$/.test(t.address)
    && (!want || t.symbol.toLowerCase().includes(want) || t.name.toLowerCase() === want || t.address === want));
  const out: Holding[] = [];
  const reader = withSafeMulticall(client);
  const chunks: CatalogToken[][] = [];
  for (let i = 0; i < list.length; i += 600) chunks.push(list.slice(i, i + 600));
  let next = 0;
  let partial = false;
  const worker = async () => {
    while (next < chunks.length) {
      if (Date.now() > deadline) { partial = true; return; }
      const chunk = chunks[next++];
      const res = await Promise.race([
        reader.multicall({
          contracts: chunk.map((t) => ({ address: t.address as Addr, abi: erc20Abi, functionName: 'balanceOf' as const, args: [wallet] as const })),
          allowFailure: true, batchSize: 0,
        }),
        new Promise<null>((ok) => setTimeout(() => ok(null), Math.max(500, deadline - Date.now()))),
      ]).catch(() => null);
      if (!res) { partial = true; continue; }
      res.forEach((r, j) => {
        if (r.status !== 'success' || (r.result as bigint) === 0n) return;
        const t = chunk[j];
        const balance = formatUnits(r.result as bigint, t.decimals);
        out.push({ chainId, address: t.address, symbol: t.symbol, name: t.name, decimals: t.decimals, balance, usd: t.priceUsd ? Number(balance) * t.priceUsd : null, listed: true, verified: t.verified });
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, chunks.length) }, worker));
  return { holdings: out, partial };
}

/** Every ERC-20 the wallet holds, from Blockscout's index; `complete` is false when there is no index for the chain. */
async function blockscoutHoldings(chainId: number, wallet: Addr): Promise<{ holdings: Holding[]; complete: boolean }> {
  const key = process.env.BLOCKSCOUT_API_KEY;
  if (!key || !BLOCKSCOUT_PRO.has(chainId)) return { holdings: [], complete: false };
  const r = await fetch(`https://api.blockscout.com/${chainId}/api/v2/addresses/${wallet}/token-balances?apikey=${key}`, { signal: AbortSignal.timeout(9_000) });
  if (!r.ok) return { holdings: [], complete: false };
  const rows = await r.json() as { value?: string; token?: { address_hash?: string; symbol?: string; name?: string; decimals?: string; exchange_rate?: string | null; type?: string; reputation?: string | null } }[];
  const holdings = rows.flatMap((row): Holding[] => {
    const t = row.token;
    if (t?.type !== 'ERC-20' || !t.address_hash || !row.value || row.value === '0' || t.reputation === 'scam') return [];
    const decimals = Number(t.decimals ?? 18);
    const balance = formatUnits(BigInt(row.value), Number.isFinite(decimals) ? decimals : 18);
    const price = Number(t.exchange_rate) || 0;
    return [{ chainId, address: t.address_hash.toLowerCase(), symbol: t.symbol ?? '?', name: t.name ?? t.symbol ?? '', decimals, balance, usd: price ? Number(balance) * price : null, listed: t.reputation === 'ok' }];
  });
  return { holdings, complete: true };
}

async function chainHoldings(chainId: number, wallet: Addr, search?: string): Promise<{ holdings: Holding[]; error?: string; partial?: boolean }> {
  const client = getChainClient(chainId);
  if (!client) return { holdings: [], error: 'no RPC for this chain' };
  const [native, listed, indexed] = await Promise.allSettled([
    nativeHolding(client, chainId, wallet), catalogHoldings(client, chainId, wallet, Date.now() + 9_000, search), blockscoutHoldings(chainId, wallet),
  ]);
  const map = new Map<string, Holding>();
  if (native.status === 'fulfilled' && native.value) map.set('ETH', native.value);
  for (const h of indexed.status === 'fulfilled' ? indexed.value.holdings : []) map.set(h.address, h);
  for (const h of listed.status === 'fulfilled' ? listed.value.holdings : []) map.set(h.address, h); // catalog prices win
  // A token asked for by name that neither index knows: look it up and read its balance directly.
  if (search && ![...map.values()].some((h) => matches(h, search))) {
    const found = await findToken(search, chainId).catch(() => null);
    for (const t of (found?.tokens ?? []).slice(0, 2) as { address: string; symbol?: string; name?: string; decimals?: number; priceUsd?: number }[]) {
      if (!/^0x[0-9a-f]{40}$/.test(t.address)) continue;
      const raw = await client.readContract({ address: t.address as Addr, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] }).catch(() => 0n);
      if (raw === 0n) continue;
      const decimals = t.decimals ?? Number(await client.readContract({ address: t.address as Addr, abi: erc20Abi, functionName: 'decimals' }).catch(() => 18));
      const balance = formatUnits(raw, decimals);
      map.set(t.address, { chainId, address: t.address, symbol: t.symbol ?? '?', name: t.name ?? '', decimals, balance, usd: t.priceUsd ? Number(balance) * t.priceUsd : null, listed: false });
    }
  }
  const failed = listed.status === 'rejected' && native.status === 'rejected';
  // Blockscout lists every token the wallet holds, so the catalog scan running out of time only matters without it.
  const indexedAll = indexed.status === 'fulfilled' && indexed.value.complete;
  const partial = listed.status === 'fulfilled' && listed.value.partial && !indexedAll;
  return { holdings: [...map.values()], ...(failed ? { error: 'could not read this chain right now' } : partial ? { partial: true } : {}) };
}

function matches(h: Holding, search: string): boolean {
  const s = search.trim().toLowerCase();
  return h.symbol.toLowerCase() === s || h.name.toLowerCase() === s || h.address === s || h.symbol.toLowerCase().includes(s);
}

export async function walletTokens(a: { wallet: string; chain?: string; search?: string; minUsd?: number }) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(a.wallet)) throw new Error('wallet must be a 0x address.');
  const wallet = a.wallet.toLowerCase() as Addr;
  let chains = DEFAULT_CHAINS;
  if (a.chain) {
    const id = tokenChainId(a.chain);
    if (!id) throw new Error(`Unknown chain "${a.chain}".`);
    chains = [id];
  }
  const results = await Promise.all(chains.map(async (c) => {
    try { return { chainId: c, ...(await Promise.race([chainHoldings(c, wallet, a.search), new Promise<never>((_, no) => setTimeout(() => no(new Error('timed out')), 14_000))])) }; }
    catch (e) { return { chainId: c, holdings: [] as Holding[], error: (e as Error).message }; }
  }));
  let holdings = results.flatMap((r) => r.holdings);
  if (a.search) holdings = holdings.filter((h) => matches(h, a.search!));
  const minUsd = a.minUsd ?? 0;
  holdings = holdings.filter((h) => h.usd == null ? !!a.search || h.listed : h.usd >= minUsd)
    .sort((x, y) => (y.usd ?? 0) - (x.usd ?? 0));
  const total = holdings.reduce((s, h) => s + (h.usd ?? 0), 0);
  // Two different contracts with one symbol on one chain (Aero and Aerodrome Finance are both "AERO" on Base): say so,
  // so an agent never quotes or swaps the wrong one.
  const bySymbol = new Map<string, Holding[]>();
  for (const h of holdings) {
    if (h.address === 'ETH') continue;
    const k = `${h.chainId}:${h.symbol.toLowerCase()}`;
    bySymbol.set(k, [...(bySymbol.get(k) ?? []), h]);
  }
  const sameSymbol = [...bySymbol.values()].filter((hs) => hs.length > 1).map((hs) =>
    `${hs.length} different tokens are called ${hs[0].symbol} on ${KYBER_CHAINS[hs[0].chainId] ?? hs[0].chainId}: ${hs.map((h) => `${h.name || h.symbol} (${h.address})`).join(' and ')}. They are separate contracts with their own prices; name each by its full name and address, and ask which one the person means before quoting or swapping.`);
  return {
    wallet,
    totalUsd: Math.round(total * 100) / 100,
    tokens: holdings.slice(0, 60).map((h) => ({ ...h, usd: h.usd == null ? null : Math.round(h.usd * 100) / 100, chain: KYBER_CHAINS[h.chainId] ?? String(h.chainId) })),
    chainsRead: results.map((r) => ({ chainId: r.chainId, chain: KYBER_CHAINS[r.chainId] ?? String(r.chainId), ...(r.error ? { error: r.error } : {}), ...('partial' in r && r.partial ? { partial: 'not every listed token was checked in time; pass chain to read just this one' } : {}) })),
    notes: [
      'Balances read from chain now. "listed": in the swap catalog or a known index; unlisted tokens can be airdropped spam.',
      'To sell a token: build_swap with amount "max" sells the whole balance, and give the person its signLink.',
      ...sameSymbol,
      ...(a.search && !holdings.length ? [`No "${a.search}" found on ${results.length} chains. It may be on a chain not read here: pass chain.`] : []),
    ],
  };
}

/** The wallet's full balance of a token, in whole units, for "sell all". */
export async function fullBalance(chainId: number, token: string, wallet: Addr): Promise<string> {
  const client = getChainClient(chainId);
  if (!client) throw new Error(`No RPC for chain ${chainId}.`);
  const [raw, decimals] = await Promise.all([
    client.readContract({ address: token as Addr, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] }),
    client.readContract({ address: token as Addr, abi: erc20Abi, functionName: 'decimals' }),
  ]);
  if (raw === 0n) throw new Error('The wallet holds none of tokenIn on this chain. Check wallet_tokens for where it is.');
  return formatUnits(raw, Number(decimals));
}


// ---- tx_status ----

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** Whether a transaction landed, its fee, and the tokens that moved in or out of the sender's wallet. */
export async function txStatus(a: { chain: string | number; hash: string }) {
  const chainId = tokenChainId(a.chain);
  if (!chainId) throw new Error(`Unknown chain "${a.chain}".`);
  if (!/^0x[0-9a-fA-F]{64}$/.test(a.hash)) throw new Error('hash must be a 0x transaction hash (66 characters).');
  const client = getChainClient(chainId)!;
  const hash = a.hash as `0x${string}`;
  const explorer = client.chain?.blockExplorers?.default.url;
  const link = explorer ? `${explorer}/tx/${hash}` : null;
  const receipt = await client.getTransactionReceipt({ hash }).catch(() => null);
  if (!receipt) {
    const tx = await client.getTransaction({ hash }).catch(() => null);
    return tx
      ? { chainId, hash, status: 'pending', note: 'Sent but not in a block yet. Check again in a few seconds.', link }
      : { chainId, hash, status: 'not_found', note: 'No transaction with this hash on this chain. Check the chain, or that it was sent.', link };
  }
  const [tx, block] = await Promise.all([client.getTransaction({ hash }), client.getBlock({ blockNumber: receipt.blockNumber }).catch(() => null)]);
  const wallet = receipt.from.toLowerCase();
  const pad = (addr: string) => `0x${addr.slice(2).padStart(64, '0')}`.toLowerCase();
  const moves = receipt.logs.filter((l) => l.topics[0] === TRANSFER && l.topics.length === 3
    && (l.topics[1]?.toLowerCase() === pad(wallet) || l.topics[2]?.toLowerCase() === pad(wallet)));
  const transfers = await Promise.all(moves.slice(0, 20).map(async (l) => {
    const meta = await tokenMeta(client, chainId, l.address).catch(() => ({ symbol: l.address.slice(0, 8), decimals: 18 }));
    const out = l.topics[1]?.toLowerCase() === pad(wallet);
    return {
      direction: out ? 'out' : 'in', token: l.address.toLowerCase(), symbol: meta.symbol,
      amount: formatUnits(BigInt(l.data === '0x' ? 0 : l.data), meta.decimals),
      counterparty: `0x${(out ? l.topics[2] : l.topics[1])!.slice(26)}`,
    };
  }));
  const fee = receipt.gasUsed * (receipt.effectiveGasPrice ?? 0n);
  return {
    chainId, hash,
    status: receipt.status === 'success' ? 'confirmed' : 'failed',
    ...(receipt.status !== 'success' ? { note: 'The transaction reverted: nothing changed except the gas fee. Rebuild it and check the dry run.' } : {}),
    block: Number(receipt.blockNumber),
    time: block ? new Date(Number(block.timestamp) * 1000).toISOString() : null,
    from: receipt.from, to: receipt.to,
    nativeSent: tx.value > 0n ? `${formatUnits(tx.value, 18)} ${nativeSymbol(chainId)}` : null,
    fee: `${formatUnits(fee, 18)} ${nativeSymbol(chainId)}`,
    tokenTransfers: transfers,
    link,
  };
}
