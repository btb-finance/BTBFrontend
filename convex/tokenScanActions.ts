/**
 * Runs a Token Scan: reads DexScreener (pools, price, buys and sells),
 * Blockscout (holders, top wallets) and GoPlus (contract safety), grades the
 * token and works out an LP range. Nothing is stored except the finished
 * result. The wallet pays SCAN_BTB only after the scan succeeded, and not at
 * all when a fresh scan of the token already exists (it is free to read).
 */
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { MIGRATED, RESCAN_BTB, RESCAN_MIN_AGE_MS, SCAN_BTB, SCAN_CHAINS, letterFor, turnoverNote, type ScanPillar, type ScanPool, type ScanResult, type Tone } from "./tokenScanConfig";

const UA = { "User-Agent": "curl/8.4.0" };
const BURN = new Set(["0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dead", "0xdead000000000000000042069420694206942069"]);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => `${Math.round(x * 100)}%`;
function usd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/**
 * GeckoTerminal's data (pool fees, daily prices, recent trades). Its free API limits by IP address, and Convex's
 * shared servers are always over that limit, so from here it answers 429. With COINGECKO_API_KEY set, the same
 * endpoints go through CoinGecko's on-chain API, limited per key instead. COINGECKO_PLAN=pro uses the paid host.
 */
function gecko(path: string): [string, Record<string, string>] {
  const key = process.env.COINGECKO_API_KEY;
  if (!key) return [`https://api.geckoterminal.com/api/v2${path}`, UA];
  const pro = process.env.COINGECKO_PLAN === "pro";
  return [`https://${pro ? "pro-api" : "api"}.coingecko.com/api/v3/onchain${path}`, { ...UA, [pro ? "x-cg-pro-api-key" : "x-cg-demo-api-key"]: key }];
}

/** GET as JSON, or null. A 429 (GeckoTerminal allows about 30 calls a minute) is retried twice after a short wait. */
async function getJson<T>(url: string, headers: Record<string, string> = UA): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
      if (res.status === 429 && attempt < 2) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
      return res.ok ? (await res.json()) as T : null;
    } catch { return null; }
  }
  return null;
}

interface DexPair {
  pairAddress: string; dexId: string; url?: string; labels?: string[]; pairCreatedAt?: number;
  baseToken: { address: string; symbol: string; name: string };
  quoteToken: { address: string; symbol: string; name: string };
  priceUsd?: string; priceNative?: string;
  txns?: Record<string, { buys?: number; sells?: number }>;
  volume?: Record<string, number>;
  priceChange?: Record<string, number>;
  liquidity?: { usd?: number };
  fdv?: number; marketCap?: number;
  info?: { imageUrl?: string; websites?: { url: string }[]; socials?: { type: string; url: string }[] };
}

interface BsToken { holders_count?: string; holders?: string; total_supply?: string; name?: string; symbol?: string; icon_url?: string | null }
interface GeckoTrade { block_timestamp: string; kind: string; volume_in_usd: string; to_token_address: string; tx_from_address: string }

/** Swaps bucketed by hour. A swap that pays out this token is a buy, whatever the pool's base side is. */
function flowOf(t: string, trades: GeckoTrade[]): ScanResult["flow"] | null {
  const rows = trades
    .map((x) => ({ at: Date.parse(x.block_timestamp) / 1000, usd: Number(x.volume_in_usd) || 0, buy: x.to_token_address?.toLowerCase() === t, who: x.tx_from_address?.toLowerCase() }))
    .filter((x) => Number.isFinite(x.at));
  if (rows.length === 0) return null;
  const from = Math.min(...rows.map((r) => r.at)), to = Math.max(...rows.map((r) => r.at));
  const first = Math.floor(from / 3600) * 3600, last = Math.floor(to / 3600) * 3600;
  const hours: { at: number; buyUsd: number; sellUsd: number }[] = [];
  for (let h = first; h <= last && hours.length < 48; h += 3600) hours.push({ at: h, buyUsd: 0, sellUsd: 0 });
  let buyUsd = 0, sellUsd = 0;
  for (const r of rows) {
    const b = hours[Math.floor((r.at - first) / 3600)];
    if (!b) continue;
    if (r.buy) { b.buyUsd += r.usd; buyUsd += r.usd; } else { b.sellUsd += r.usd; sellUsd += r.usd; }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const big = [...rows].sort((x, y) => y.usd - x.usd).slice(0, 10).map((r) => ({ at: r.at, usd: round(r.usd), buy: r.buy, wallet: r.who ?? "" }));
  return {
    from, to, trades: rows.length, wallets: new Set(rows.map((r) => r.who).filter(Boolean)).size,
    buyUsd: round(buyUsd), sellUsd: round(sellUsd),
    hours: hours.map((h) => ({ at: h.at, buyUsd: round(h.buyUsd), sellUsd: round(h.sellUsd) })),
    big,
  };
}

interface BsHolder { address: { hash: string; is_contract?: boolean; name?: string | null }; value: string }

type GoPlusRow = Record<string, string | undefined> & {
  holders?: { address: string; is_contract: number | string; percent: string }[];
  lp_holders?: { address: string; is_locked: number | string; percent: string }[];
};
const GOPLUS_FLAGS: [string, string, "1" | "0"][] = [
  ["is_mintable", "Owner can mint more tokens", "1"],
  ["hidden_owner", "Has a hidden owner", "1"],
  ["can_take_back_ownership", "Ownership can be taken back", "1"],
  ["owner_change_balance", "Owner can change balances", "1"],
  ["transfer_pausable", "Transfers can be paused", "1"],
  ["is_blacklisted", "Wallets can be blacklisted", "1"],
  ["slippage_modifiable", "Tax can be changed by the owner", "1"],
  ["selfdestruct", "Contract can self destruct", "1"],
  ["is_open_source", "Contract source is not verified", "0"],
];

export const scan = action({
  // rescan: fetch fresh data even though a scan is open (RESCAN_BTB). seenAt: when the scan the wallet saw was made.
  args: { sessionToken: v.string(), chainId: v.float64(), token: v.string(), rescan: v.optional(v.boolean()), seenAt: v.optional(v.union(v.float64(), v.null())) },
  handler: async (ctx, { sessionToken, chainId, token, rescan, seenAt }): Promise<{ ok: true; charged: boolean } | { ok: false; reason: string }> => {
    const chain = SCAN_CHAINS[chainId];
    if (!chain) return { ok: false, reason: "That chain is not supported yet." };
    if (!/^0x[0-9a-fA-F]{40}$/.test(token)) return { ok: false, reason: "That is not a token address." };
    const t = token.toLowerCase();

    const wallet = await ctx.runQuery(internal.sessions.walletFor, { token: sessionToken });
    if (!wallet) return { ok: false, reason: "Sign-in expired. Sign again to scan." };
    const pre = await ctx.runQuery(internal.tokenScan.before, { chainId, token: t, wallet });
    if (pre.fresh && !rescan) return { ok: true, charged: false };
    // Someone already refreshed it since this wallet looked: show theirs, charge nothing, fetch nothing.
    if (pre.fresh && rescan && (pre.latestAt ?? 0) > (seenAt ?? 0)) return { ok: true, charged: false };
    if (pre.fresh && rescan && Date.now() - (pre.latestAt ?? 0) < RESCAN_MIN_AGE_MS) return { ok: false, reason: "This token was scanned in the last 15 minutes. Rescan opens shortly." };
    const price = pre.fresh ? RESCAN_BTB : SCAN_BTB;
    if (pre.available < price) return { ok: false, reason: `${pre.fresh ? "A rescan" : "A scan"} costs ${price} BTB. Top up your BTB balance to run it.` };

    const previous = pre.previous ? (() => {
      try {
        const d = JSON.parse(pre.previous.data) as ScanResult;
        return { at: pre.previous.createdAt, holders: d.holders, top10Share: d.top10Share, score: d.grade.score, liquidityUsd: d.liquidityUsd, marketCapUsd: d.marketCapUsd, volume24hUsd: d.volume24hUsd, signals: d.signals.map((s) => s.text), stance: d.lp.stance };
      } catch { return null; }
    })() : null;

    const result = await computeScan(chainId, t, previous);
    if (!result) return { ok: false, reason: `No DEX pools found for this token on ${chain.name}. Nothing was charged.` };
    // Fee rates, prices and trades all come from GeckoTerminal. If every one of them is missing, the scan would be
    // half empty, so it is not saved and nothing is charged.
    const geckoDown = !(result.lp.pools ?? []).some((p) => p.feePct != null) && !result.history?.length && !result.flow;
    if (geckoDown) return { ok: false, reason: "Our market data source is not answering right now, so this scan would miss fees, prices and trades. Nothing was charged. Try again in a few minutes." };
    return await ctx.runMutation(internal.tokenScan.save, {
      chainId, token: t, symbol: result.symbol, score: result.grade.score, data: JSON.stringify(result), wallet,
      rescan: !!rescan, seenAt: seenAt ?? null,
    });
  },
});

/**
 * Fetches every source and builds the result, with no charge and no storage. Null when the token has no DEX pool on
 * the chain. The action calls it; scripts can too, to test the grading against live data.
 */
export async function computeScan(chainId: number, t: string, previous: ScanResult["previous"]): Promise<ScanResult | null> {
  const chain = SCAN_CHAINS[chainId];
  const [pairsRaw, bsToken, bsHolders, goplus] = await Promise.all([
    getJson<DexPair[]>(`https://api.dexscreener.com/token-pairs/v1/${chain.dex}/${t}`),
    chain.blockscout ? getJson<BsToken>(`${chain.blockscout}/api/v2/tokens/${t}`) : Promise.resolve(null),
    chain.blockscout ? getJson<{ items?: BsHolder[] }>(`${chain.blockscout}/api/v2/tokens/${t}/holders`) : Promise.resolve(null),
    getJson<{ result?: Record<string, GoPlusRow> | null }>(`https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${t}`),
  ]);
  const pairs = (pairsRaw ?? []).filter((p) => p.baseToken?.address?.toLowerCase() === t || p.quoteToken?.address?.toLowerCase() === t);
  const gp = goplus?.result?.[t] ?? null;
  if (pairs.length === 0) return null;

  // From the deepest pool: 30 days of daily closes and volume priced in this token, and its latest 300 swaps.
  // Holders: a second Blockscout page, so ranks 51 to 100 are known.
  const deepest = [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  const poolPath = `/networks/${chain.gecko}/pools/${deepest.pairAddress}`;
  const next = (bsHolders as { next_page_params?: Record<string, string | number> | null } | null)?.next_page_params;
  const [ohlcv, trades, holders2, poolInfo] = await Promise.all([
    getJson<{ data?: { attributes?: { ohlcv_list?: number[][] } } }>(...gecko(`${poolPath}/ohlcv/day?limit=30&currency=usd&token=${t}`)),
    getJson<{ data?: { attributes: GeckoTrade }[] }>(...gecko(`${poolPath}/trades`)),
    next && chain.blockscout
      ? getJson<{ items?: BsHolder[] }>(`${chain.blockscout}/api/v2/tokens/${t}/holders?${new URLSearchParams(Object.entries(next).map(([k, v]) => [k, String(v)]))}`)
      : Promise.resolve(null),
    getJson<{ data?: { attributes: { address: string; pool_fee_percentage?: string | null } }[] }>(...gecko(
      `/networks/${chain.gecko}/pools/multi/${[...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)).slice(0, 10).map((p) => p.pairAddress).join(",")}`)),
  ]);
  const days = (ohlcv?.data?.attributes?.ohlcv_list ?? [])
    .filter((r) => Number.isFinite(r[0]) && Number.isFinite(r[4]) && r[4] > 0)
    .sort((a, b) => a[0] - b[0]);
  const history = days.map((r) => [r[0], r[4]] as [number, number]);
  const volumeHistory = days.map((r) => [r[0], Number.isFinite(r[5]) ? r[5] : 0] as [number, number]);
  const holderRows = bsHolders?.items ? [...bsHolders.items, ...(holders2?.items ?? [])] : null;

  const result = build(chainId, t, pairs, bsToken, holderRows, gp, previous, history);
  if (volumeHistory.length) result.volumeHistory = volumeHistory;
  const flow = flowOf(t, trades?.data?.map((d) => d.attributes) ?? []);
  if (flow) result.flow = flow;
  // Fee and fee rate for each pool, then the best one to LP in: the highest fee rate among pools at least a tenth as
  // deep as the deepest (and $25K), so a tiny pool with one lucky trade does not win.
  const feeBy = new Map((poolInfo?.data ?? []).map((x) => [x.attributes.address.toLowerCase(), Number(x.attributes.pool_fee_percentage)]));
  for (const p of result.lp.pools ?? []) {
    const f = feeBy.get(p.pair.toLowerCase());
    p.feePct = f != null && Number.isFinite(f) && f > 0 ? f : null;
    p.feeApr = p.feePct != null && p.liquidityUsd > 0 ? (p.volume24hUsd * (p.feePct / 100) / p.liquidityUsd) * 365 : null;
  }
  const deepPool = result.lp.pools?.[0];
  const floor = Math.max(25_000, (deepPool?.liquidityUsd ?? 0) * 0.1);
  // Old Aerodrome and Velodrome pools lost their gauges when Aero launched, so they are never the pick.
  const retired = new Set(["aerodrome", "velodrome"]);
  const best = (result.lp.pools ?? []).filter((p) => p.feeApr != null && p.liquidityUsd >= floor && !retired.has(p.dex)).sort((a, b) => (b.feeApr ?? 0) - (a.feeApr ?? 0))[0];
  result.lp.bestPair = best?.pair ?? null;
  // Earnings and the backtest price the pool Add LP opens: the best one, else the deepest.
  const target = best ?? deepPool;
  if (target) {
    // The plan's turnover and its note describe the pool Add LP opens, not the deepest one.
    const old = result.lp.turnover != null ? turnoverNote(result.lp.turnover) : null;
    result.lp.turnover = target.liquidityUsd > 0 ? target.volume24hUsd / target.liquidityUsd : null;
    const fresh = result.lp.turnover != null ? turnoverNote(result.lp.turnover) : null;
    result.lp.notes = result.lp.notes.filter((n) => n && n !== old);
    if (fresh) result.lp.notes.splice(1, 0, fresh);
    result.lp.pool = target;
    result.lp.feePct = target.feePct ?? null;
    // Keep the deepest pool's day to day pattern, but make its average equal the chosen pool's own last day.
    const vols = volumeHistory.map((v) => v[1]).filter((v) => v > 0);
    const avg = vols.length ? vols.reduce((s, v) => s + v, 0) / vols.length : 0;
    result.lp.volumeScale = target === deepPool || avg <= 0 ? 1 : target.volume24hUsd / avg;
  }
  return result;
}

function build(chainId: number, t: string, pairs: DexPair[], bs: BsToken | null, holderRows: BsHolder[] | null, gp: GoPlusRow | null, previous: ScanResult["previous"], history: [number, number][]): ScanResult {
  // ── Market, from DexScreener. In a pair where the token is the quote side, buys and sells are the other way round.
  const byLiq = [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  const asBase = byLiq.find((p) => p.baseToken.address.toLowerCase() === t);
  const top = byLiq[0];
  const meta = asBase?.baseToken ?? (top ? (top.baseToken.address.toLowerCase() === t ? top.baseToken : top.quoteToken) : null);
  let priceUsd: number | null = null;
  if (asBase?.priceUsd) priceUsd = Number(asBase.priceUsd);
  else if (top?.priceUsd && top.priceNative && Number(top.priceNative) > 0) priceUsd = Number(top.priceUsd) / Number(top.priceNative);
  const tx = (w: string) => pairs.reduce((acc, p) => {
    const row = p.txns?.[w] ?? {};
    const isBase = p.baseToken.address.toLowerCase() === t;
    acc.buys += (isBase ? row.buys : row.sells) ?? 0;
    acc.sells += (isBase ? row.sells : row.buys) ?? 0;
    return acc;
  }, { buys: 0, sells: 0 });
  const txns24h = tx("h24"), txns1h = tx("h1");
  const liquidityUsd = pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);
  const volume24hUsd = pairs.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0);
  const ch = (w: string) => (asBase?.priceChange?.[w] ?? null);
  const change = { h1: ch("h1"), h6: ch("h6"), h24: ch("h24") };

  // ── Holders, from Blockscout. Pools and burn addresses do not count as holders.
  const supply = (() => { try { return BigInt(bs?.total_supply ?? "0"); } catch { return 0n; } })();
  const pairSet = new Set(pairs.map((p) => p.pairAddress.toLowerCase()));
  let top10Share: number | null = null, inPoolsShare: number | null = null, burnedShare: number | null = null;
  let concentration: ScanResult["concentration"], topHolders: ScanResult["topHolders"];
  if (holderRows && supply > 0n) {
    let pooled = 0n, burned = 0n;
    const people: { addr: string; val: bigint; name: string | null; contract: boolean }[] = [];
    for (const h of holderRows) {
      const addr = h.address.hash.toLowerCase();
      const val = (() => { try { return BigInt(h.value); } catch { return 0n; } })();
      if (BURN.has(addr)) { burned += val; continue; }
      const poolLike = pairSet.has(addr) || (h.address.is_contract && /pool|pair|vault|lock|escrow/i.test(h.address.name ?? ""));
      if (poolLike) { pooled += val; continue; }
      people.push({ addr, val, name: h.address.name ?? null, contract: !!h.address.is_contract });
    }
    const live = supply - burned;
    const share = (x: bigint) => (live > 0n ? Number((x * 1_000_000n) / live) / 1_000_000 : 0);
    const sum = (from: number, to: number) => people.slice(from, to).reduce((s, x) => s + x.val, 0n);
    top10Share = share(sum(0, 10));
    inPoolsShare = share(pooled);
    burnedShare = Number((burned * 1_000_000n) / supply) / 1_000_000;
    const r11to50 = share(sum(10, 50)), r51to100 = holderRows.length > 50 ? share(sum(50, 100)) : 0;
    concentration = { top10: top10Share, r11to50, r51to100, pools: inPoolsShare, rest: Math.max(0, 1 - top10Share - r11to50 - r51to100 - inPoolsShare) };
    topHolders = people.slice(0, 10).map((p) => ({ address: p.addr, share: share(p.val), label: p.name, contract: p.contract }));
  } else if (Array.isArray(gp?.holders) && gp.holders.length > 0) {
    // Blockscout is missing on this chain or did not answer: GoPlus lists the top 10 with their share of supply.
    // It gives no names, so every contract (pools, lockers, vaults) is left out of the top 10.
    let pooled = 0, burned = 0;
    const people: number[] = [];
    for (const h of gp.holders) {
      const p = Number(h.percent) || 0;
      if (BURN.has(String(h.address).toLowerCase())) burned += p;
      else if (Number(h.is_contract) === 1) pooled += p;
      else people.push(p);
    }
    const live = Math.max(1e-9, 1 - burned);
    top10Share = people.reduce((s, x) => s + x, 0) / live;
    inPoolsShare = pooled / live;
    burnedShare = burned;
  }
  const holders = Number(bs?.holders_count ?? bs?.holders ?? gp?.holder_count ?? NaN);

  // ── Contract safety, from GoPlus.
  const num = (s?: string) => (s == null || s === "" ? null : Number(s) * 100);
  const safety = {
    checked: !!gp,
    honeypot: gp?.is_honeypot === "1" || gp?.cannot_sell_all === "1",
    buyTaxPct: num(gp?.buy_tax),
    sellTaxPct: num(gp?.sell_tax),
    flags: gp ? GOPLUS_FLAGS.filter(([k, , bad]) => gp[k] === bad).map(([, label]) => label) : [],
    details: gp ? {
      creatorPct: gp.creator_percent != null ? Number(gp.creator_percent) : null,
      ownerPct: gp.owner_percent != null ? Number(gp.owner_percent) : null,
      ownerRenounced: gp.owner_address == null ? null : gp.owner_address === "" || /^0x0+$/.test(gp.owner_address) || BURN.has(gp.owner_address.toLowerCase()),
      lpLockedPct: Array.isArray(gp.lp_holders) && gp.lp_holders.length
        ? gp.lp_holders.filter((h) => Number(h.is_locked) === 1 || BURN.has(String(h.address).toLowerCase())).reduce((s, h) => s + (Number(h.percent) || 0), 0)
        : null,
      proxy: gp.is_proxy == null ? null : gp.is_proxy === "1",
      openSource: gp.is_open_source == null ? null : gp.is_open_source === "1",
      sameCreatorHoneypot: gp.honeypot_with_same_creator == null ? null : gp.honeypot_with_same_creator === "1",
    } : undefined,
  };

  // ── Pillars, each 0..100.
  const flowTotal = txns24h.buys + txns24h.sells;
  const buyShare = flowTotal > 0 ? txns24h.buys / flowTotal : 0.5;
  const pillars: ScanPillar[] = [
    {
      key: "safety", label: "Safety", weight: 0.25,
      score: !safety.checked ? null : safety.honeypot ? 0 : Math.max(0, 100 - Math.min(60, (safety.sellTaxPct ?? 0) * 4) - Math.min(30, (safety.buyTaxPct ?? 0) * 2) - safety.flags.length * 12),
      note: !safety.checked ? "No contract check available on this chain." : safety.honeypot ? "This token cannot be sold." : safety.flags.length ? safety.flags[0] : "No risky contract powers found.",
    },
    {
      key: "depth", label: "Liquidity", weight: 0.25,
      score: liquidityUsd > 0 ? Math.round(clamp01((Math.log10(liquidityUsd) - 3) / 4) * 100) : 0,
      note: `${usd(liquidityUsd)} across ${pairs.length} pool${pairs.length === 1 ? "" : "s"}.`,
    },
    {
      key: "concentration", label: "Spread", weight: 0.2,
      score: top10Share == null ? null : Math.round(clamp01((0.9 - top10Share) / 0.6) * 100),
      note: top10Share == null ? "Holder list not available on this chain." : `Top 10 wallets hold ${pct(top10Share)}, pools left out.`,
    },
    {
      key: "holders", label: "Holders", weight: 0.1,
      score: Number.isFinite(holders) ? Math.round(clamp01((Math.log10(Math.max(1, holders)) - 1) / 4) * 100) : null,
      note: Number.isFinite(holders) ? `${holders.toLocaleString("en-US")} wallets hold it.` : "Holder count not available on this chain.",
    },
    {
      key: "flow", label: "Flow", weight: 0.2,
      score: flowTotal === 0 ? 0 : Math.round(clamp01((75 + (buyShare - 0.5) * 100) / 100) * 100 * Math.min(1, flowTotal / 50) + 20 * (1 - Math.min(1, flowTotal / 50))),
      note: flowTotal === 0 ? "No swaps in the last 24 hours." : `${txns24h.buys} buys and ${txns24h.sells} sells in 24 hours.`,
    },
  ];
  const scored = pillars.filter((p) => p.score != null);
  const wsum = scored.reduce((s, p) => s + p.weight, 0);
  let score = wsum > 0 ? Math.round(scored.reduce((s, p) => s + (p.score as number) * p.weight, 0) / wsum) : 0;

  // ── Caps: one serious problem limits the grade however good the rest looks.
  const caps: [boolean, number, string][] = [
    [safety.honeypot, 10, "Cannot be sold"],
    [!!safety.details?.sameCreatorHoneypot, 40, "Creator has made honeypots before"],
    [!!MIGRATED[`${chainId}:${t}`], 35, "Old token, moved to a new contract"],
    [(safety.sellTaxPct ?? 0) >= 20, 30, "Sell tax of 20% or more"],
    [liquidityUsd < 10_000, 54, "Liquidity under $10K"],
    [(top10Share ?? 0) >= 0.5, 69, "Top 10 wallets hold half or more"],
  ];
  let capped: string | null = null;
  for (const [hit, max, why] of caps) if (hit && score > max) { score = max; capped = why; }

  // ── Signals, worst first.
  const signals: { tone: Tone; text: string }[] = [];
  if (safety.honeypot) signals.push({ tone: "bad", text: "Cannot be sold: the contract blocks sells" });
  if ((safety.sellTaxPct ?? 0) >= 10) signals.push({ tone: "bad", text: `Sell tax is ${safety.sellTaxPct!.toFixed(0)}%` });
  else if ((safety.sellTaxPct ?? 0) > 0 || (safety.buyTaxPct ?? 0) > 0) signals.push({ tone: "warn", text: `Trades are taxed: buy ${(safety.buyTaxPct ?? 0).toFixed(1)}%, sell ${(safety.sellTaxPct ?? 0).toFixed(1)}%` });
  for (const f of safety.flags) signals.push({ tone: "warn", text: f });
  const det = safety.details;
  if (det?.sameCreatorHoneypot) signals.push({ tone: "bad", text: "The same creator has made honeypot tokens before" });
  if ((det?.creatorPct ?? 0) >= 0.05) signals.push({ tone: "warn", text: `The creator still holds ${pct(det!.creatorPct!)} of supply` });
  if ((det?.ownerPct ?? 0) >= 0.05) signals.push({ tone: "warn", text: `The owner wallet holds ${pct(det!.ownerPct!)} of supply` });
  if (det?.proxy) signals.push({ tone: "warn", text: "Upgradeable contract: its code can be changed" });
  const moved = MIGRATED[`${chainId}:${t}`];
  if (moved) signals.push({ tone: "bad", text: `${moved.note}. Scan ${moved.to.slice(0, 6)}…${moved.to.slice(-4)} instead` });
  if (liquidityUsd < 10_000) signals.push({ tone: "bad", text: `Only ${usd(liquidityUsd)} of liquidity: one trade can move the price a lot` });
  else if (liquidityUsd < 100_000) signals.push({ tone: "warn", text: `Thin liquidity at ${usd(liquidityUsd)}` });
  else signals.push({ tone: "good", text: `Deep liquidity at ${usd(liquidityUsd)}` });
  if (top10Share != null) {
    if (top10Share >= 0.5) signals.push({ tone: "bad", text: `Top 10 wallets hold ${pct(top10Share)} of supply` });
    else if (top10Share >= 0.3) signals.push({ tone: "warn", text: `Top 10 wallets hold ${pct(top10Share)} of supply` });
    else signals.push({ tone: "good", text: `Supply is spread out: top 10 hold ${pct(top10Share)}` });
  }
  if (flowTotal < 5) signals.push({ tone: "warn", text: `Barely traded: ${flowTotal} swap${flowTotal === 1 ? "" : "s"} in 24 hours` });
  else if (txns24h.sells > txns24h.buys * 1.5) signals.push({ tone: "bad", text: `Sellers lead buyers ${(txns24h.sells / Math.max(1, txns24h.buys)).toFixed(1)} to 1 today` });
  else if (txns24h.buys > txns24h.sells * 1.5) signals.push({ tone: "good", text: `Buyers lead sellers ${(txns24h.buys / Math.max(1, txns24h.sells)).toFixed(1)} to 1 today` });
  else signals.push({ tone: "good", text: "Two sided trading today, good for LP fees" });
  if (change.h24 != null && change.h24 <= -20) signals.push({ tone: "bad", text: `Price down ${Math.abs(change.h24).toFixed(0)}% in 24 hours` });
  else if (change.h24 != null && change.h24 >= 30) signals.push({ tone: "warn", text: `Price up ${change.h24.toFixed(0)}% in 24 hours: spikes often fade` });
  if (previous?.holders != null && Number.isFinite(holders) && holders !== previous.holders) {
    const d = holders - previous.holders;
    signals.push({ tone: d > 0 ? "good" : "warn", text: `${d > 0 ? "+" : ""}${d.toLocaleString("en-US")} holders since the last scan` });
  }
  const order: Record<Tone, number> = { bad: 0, warn: 1, good: 2 };
  signals.sort((a, b) => order[a.tone] - order[b.tone]);
  const firstBad = signals.find((s) => s.tone !== "good");
  const headline = firstBad ?? { tone: "good" as Tone, text: "No red flags found" };

  // ── LP: range width from volatility, shifted toward where the flow points. With 30 days of closes the width is
  // two weeks of typical movement (daily spread × √14); without, it falls back to the last day's swings.
  const rets: number[] = [];
  for (let i = 1; i < history.length; i++) rets.push(Math.log(history[i][1] / history[i - 1][1]));
  const mean = rets.reduce((s, r) => s + r, 0) / Math.max(1, rets.length);
  const dailySd = rets.length >= 7 ? Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1)) : null;
  const vol = dailySd != null
    ? (Math.exp(dailySd * Math.sqrt(14)) - 1) * 100
    : Math.max(Math.abs(change.h24 ?? 0), Math.abs(change.h6 ?? 0) * 2, Math.abs(change.h1 ?? 0) * 4.9) * 1.5;
  const half = Math.max(5, Math.min(60, vol || 10));
  let lowerPct = -half, upperPct = half;
  const notes: string[] = [];
  const sym = meta?.symbol ?? "the token";
  if (flowTotal >= 10 && buyShare < 0.4) {
    lowerPct = -half * 1.4; upperPct = half * 0.6;
    notes.push(`Sellers lead, so the range sits mostly below the price. If it keeps falling you still earn fees, and you end up holding more ${sym}.`);
  } else if (flowTotal >= 10 && buyShare > 0.6) {
    lowerPct = -half * 0.6; upperPct = half * 1.4;
    notes.push("Buyers lead, so the range leans above the price to stay in range if it keeps climbing.");
  } else {
    notes.push("Flow is balanced, so the range is centered on the price.");
  }
  const deepest = byLiq[0];
  const turnover = deepest && (deepest.liquidity?.usd ?? 0) > 0 ? (deepest.volume?.h24 ?? 0) / (deepest.liquidity!.usd as number) : null;
  if (turnover != null) {
    notes.push(turnoverNote(turnover) ?? "");
  }
  if ((top10Share ?? 0) >= 0.5) notes.push("A few wallets hold most of the supply. One big sale can push the price out of your range.");
  if (liquidityUsd < 10_000) notes.push("The pools are very thin. Wait for liquidity to grow before adding a range.");
  const stance: ScanResult["lp"]["stance"] =
    safety.honeypot || (safety.sellTaxPct ?? 0) >= 10 || liquidityUsd < 10_000 || score < 40 ? "avoid"
      : score < 70 || (top10Share ?? 0) >= 0.5 ? "careful" : "good";
  const toPool = (p: DexPair): ScanPool => {
    const other = p.baseToken.address.toLowerCase() === t ? p.quoteToken : p.baseToken;
    return {
      pair: p.pairAddress,
      dex: p.dexId,
      version: p.labels?.[0] ?? null,
      quote: other.symbol,
      quoteAddress: other.address.toLowerCase(),
      liquidityUsd: p.liquidity?.usd ?? 0,
      volume24hUsd: p.volume?.h24 ?? 0,
      url: p.url ?? `https://dexscreener.com/${SCAN_CHAINS[chainId].dex}/${p.pairAddress}`,
    };
  };
  const pool: ScanPool | null = deepest ? toPool(deepest) : null;
  const pools = byLiq.slice(0, 10).map(toPool);

  return {
    version: 1, chainId, token: t,
    symbol: meta?.symbol ?? bs?.symbol ?? "?",
    name: meta?.name ?? bs?.name ?? "Unknown token",
    logo: asBase?.info?.imageUrl ?? bs?.icon_url ?? null,
    priceUsd, marketCapUsd: asBase?.marketCap ?? null, fdvUsd: asBase?.fdv ?? null, change,
    liquidityUsd, poolCount: pairs.length, volume24hUsd, txns24h, txns1h,
    holders: Number.isFinite(holders) ? holders : null, top10Share, inPoolsShare, burnedShare,
    safety,
    grade: { score, letter: letterFor(score), capped },
    pillars, signals, headline,
    lp: { stance, lowerPct: Math.round(lowerPct), upperPct: Math.round(upperPct), turnover, notes, pool, pools },
    history: history.length ? history : undefined,
    concentration, topHolders,
    meta: {
      createdAt: pairs.reduce<number | null>((m, p) => (p.pairCreatedAt && (m == null || p.pairCreatedAt < m) ? p.pairCreatedAt : m), null),
      websites: [...new Set(pairs.flatMap((p) => (p.info?.websites ?? []).map((w) => w.url)))].slice(0, 3),
      socials: pairs.flatMap((p) => p.info?.socials ?? []).filter((x, i, arr) => arr.findIndex((y) => y.url === x.url) === i).slice(0, 4),
    },
    previous,
  };
}
