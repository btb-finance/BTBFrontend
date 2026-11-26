import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { api } from '../../../convex/_generated/api';
import { CHECK_INTERVALS, FREE_ACTIONS, BTB_USD, REBALANCE_USD, dailyCheckBtb, intervalLabel, rebalanceBtb } from '../../../convex/autoRebalanceConfig';
import type { EarnPool } from '../pools';
import { chainSlug } from '../routes';
import {
  LETTERS, SITE, addable, brief, chainIdOf, chainKey, convex, feePct, findPool, headlineApr, median, poolKey, poolLink,
  poolRisk, portfolioLink, round2, scanLink, searchPools, snapshot, tokenGrade, type Letter,
} from './data';
import { walletPositions } from './positions';
import { buildAddLiquidity, buildSwap } from './build';
import { abiSummary, buildTx, readContract } from './contracts';
import { listProtocols, protocolDetail } from './registry';
import { findToken, fullBalance, quickTokenCheck, quoteSwap, tokenChainId, txStatus, walletTokens } from './tokens';
import { lendingRates, stakingRates } from './lending';
import { buildLend, buildWithdraw } from './aave';
import { buildZapLiquidity } from './zap';
import { signLink, type SignStep } from '../signLink';
import type { TxOut } from './build';

// The BTB connector: Discover's pools for any MCP client (claude.ai, Claude Code, other agents). No tool signs or
// moves money. Agents with their own wallet get unsigned transactions from build_swap and build_add_liquidity and
// send them themselves; people get links to btb.finance, where their own wallet signs.

const INSTRUCTIONS = `BTB Finance: live liquidity pools across Base, Ethereum, BNB Chain, Robinhood Chain and more, with a risk grade (A best .. E worst) per pool.
- Find pools with top_pools, search_pools or best_pools_for; compare them with compare_pools; read one with pool_details.
- APRs are yearly percentages. "measured ±5% range APR" is what a ±5 % concentrated position really earned over the last days; prefer it over base APR.
- Before suggesting a pool, check its risk grade and reasons. Treat APRs above 200 % as unlikely to last.
- To see what a wallet holds: wallet_tokens (token balances on every main chain, with USD values; pass search to find one token) and wallet_positions (every LP position, with value, range and fees), plus auto_manage_status.
- Tokens: find_token gives a token's contract address on a chain (never write one from memory). quote_swap prices any swap after the BTB fee, with a warning when the pool is thin.
- To actually swap for a person: build_swap with their wallet, then give them its signLink (one link: approval if needed, then the swap). Do not stop at a quote.
- Lending and savings: lending_rates gives live supply APYs on Aave, Compound, Morpho, Spark, Euler, Fluid and more, per chain and token. Never guess a rate.
- To add liquidity from ONE token (e.g. only USDC for a USDC-cbBTC pool): build_zap_liquidity swaps the right share and opens the position, one signLink.
- To lend on Aave or take it back: build_lend and build_withdraw (live rate, position, health factor, the approval only when needed, one signLink). Use them instead of build_tx for Aave.
- After the person signs, tx_status (chain + transaction hash) says whether it confirmed and what moved.
- Staking: staking_rates gives each liquid-staking token's yield (stETH/wstETH, weETH, rETH, cbETH...). For pools holding one, that half also earns it: add it to the pool APR when comparing.
- Token safety: when token_safety has no recent scan, quick_token_check gives a free basic check (honeypot, taxes, owner powers). find_token marks matches tradeable or not.
- This server never signs. Every build tool returns a signLink: give it to the person, it opens btb.finance with the steps to sign in their own wallet (valid 15 minutes, only for that wallet). For an action with an approval first (lend on Aave, stake, deposit), call build_tx once with steps [approve, action] so they get one link.
- If you control a wallet yourself, build_swap (amount "max" sells the whole balance) and build_add_liquidity return unsigned transactions (approvals first, then the action) with a simulation: check it, then sign and send them in step order yourself.
- Named protocols (Lido, Uniswap, Circle, Tether, Polymarket, Hyperliquid…): list_protocols and get_protocol give their official contracts per chain, the functions to call, APIs and risks.
- Any other contract: get_abi lists what it can do (verified source or decoded bytecode, proxies followed), read_contract calls a read function, build_tx turns any function into an unsigned transaction with a dry run. Integers are in base units. Heed the warnings and flags.
- If you do not control a wallet, give the user the link from add_liquidity_link or auto_manage_setup; they review and sign on btb.finance.
- None of this is financial advice; say so when recommending.`;

const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 1) }] });
const fail = (message: string) => ({ content: [{ type: 'text' as const, text: message }], isError: true });
const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

const chainArg = z.string().optional().describe('Chain name or id, e.g. "base", "ethereum", "bnb", "robinhood", 8453. Omit for all chains.');
const riskArg = z.enum(['A', 'B', 'C', 'D', 'E']).optional().describe('Worst risk grade to include (A safest). Default: all.');
const poolArgs = {
  chain: z.string().optional().describe('Chain of the pool (not needed when pool is a key like "base:0x…").'),
  pool: z.string().describe('The pool: its key from another tool ("base:0x…") or its address / Uniswap V4 pool id.'),
};

function filtered(pools: EarnPool[], o: { chain?: string; maxRisk?: Letter; minTvlUsd?: number; stableOnly?: boolean }) {
  const c = o.chain ? chainKey(o.chain) : null;
  const worst = o.maxRisk ? LETTERS.indexOf(o.maxRisk) : 4;
  return pools
    .filter((p) => (!c || chainKey(p.chain) === c) && p.tvlUsd >= (o.minTvlUsd ?? 0) && (!o.stableOnly || p.stablecoin))
    .map((p) => ({ p, risk: poolRisk(p) }))
    .filter(({ risk }) => LETTERS.indexOf(risk.grade) <= worst);
}

const SORTS = {
  apr: (p: EarnPool) => headlineApr(p),
  tvl: (p: EarnPool) => p.tvlUsd,
  volume: (p: EarnPool) => p.volume24hUsd ?? 0,
  fees: (p: EarnPool) => p.fees24hUsd ?? 0,
};

async function poolOr(chain: string | undefined, id: string) {
  const { pools } = await snapshot();
  return findPool(pools, chain, id);
}

async function details(p: EarnPool) {
  const chainId = chainIdOf(p);
  const tokens = (p.underlyingTokens ?? []).slice(0, 2);
  const grades = await Promise.all(tokens.map((t) => tokenGrade(chainId, t)));
  const risk = poolRisk(p, grades);
  const symbols = p.pair.split('-');
  return {
    ...brief(p, risk),
    riskReasons: risk.reasons.length ? risk.reasons : ['no deductions'],
    tokens: tokens.map((t, i) => ({
      address: t, symbol: symbols[i] ?? null,
      safety: grades[i] ? { score: grades[i]!.score, honeypot: grades[i]!.honeypot, flags: grades[i]!.flags, scannedAt: new Date(grades[i]!.scannedAt).toISOString() }
        : { score: null, note: 'Not scanned in the last 24 hours. A scan on btb.finance checks contract powers, taxes, holders and liquidity.', scanLink: scanLink(chainSlug(p.chain), t) },
    })),
    merklRewards: p.merkl ? { aprPct: round2(p.merkl.apr), rewards: p.merkl.rewardSymbols, dailyRewardsUsd: Math.round(p.merkl.dailyRewardsUsd) } : null,
    apyChange1dPct: p.apyChange1d ?? null,
    poolAddressOrId: p.id,
    chainId,
  };
}

/** What `amountUsd` in this pool might earn over `days`, from its APR and, separately, from its last day of fees. */
function estimate(p: EarnPool, amountUsd: number, days: number) {
  const apr = headlineApr(p);
  const byApr = amountUsd * (apr / 100) * (days / 365);
  const share = amountUsd / (p.tvlUsd + amountUsd);
  const byFees = p.fees24hUsd != null ? p.fees24hUsd * share * days : null;
  return {
    pool: poolKey(p), pair: p.pair, amountUsd, days, aprPct: round2(apr),
    earnUsdAtApr: round2(byApr),
    earnUsdFromLast24hFeesFullRange: byFees == null ? null : round2(byFees),
    yourShareOfPoolPct: round2(share * 100),
    vsHoldPctOverMeasuredWindow: p.rangeYield ? round2(p.rangeYield.netPct) : null,
    notes: [
      'The APR figure assumes the APR holds and, for a range APR, that a ±5 % range is reset when price leaves it (auto-management does this).',
      'The fee figure is a full-range position sharing the last 24 h of fees pro rata; a concentrated range earns more while in range.',
      p.stablecoin ? 'Stable pair: little impermanent loss.' : 'Not a stable pair: price moves can lose more than the fees earn (impermanent loss).',
      'Estimates, not promises, and not financial advice.',
    ],
  };
}

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'btb-finance', title: 'BTB Finance', version: '1.0.0', websiteUrl: SITE }, { instructions: INSTRUCTIONS });

  server.registerTool('top_pools', {
    title: 'Top liquidity pools',
    description: 'Rank live liquidity pools by APR, TVL, 24h volume or 24h fees, filtered by chain, risk grade, TVL and stable pairs. Returns each pool with its risk grade and a btb.finance link.',
    inputSchema: z.object({
      chain: chainArg, maxRisk: riskArg,
      minTvlUsd: z.number().min(0).optional().describe('Minimum TVL in USD. Default 100000.'),
      stableOnly: z.boolean().optional().describe('Only pairs of two stablecoins.'),
      sortBy: z.enum(['apr', 'tvl', 'volume', 'fees']).optional().describe('Default apr.'),
      limit: z.number().int().min(1).max(50).optional().describe('Default 10.'),
    }),
    annotations: READ,
  }, async (a) => {
    const snap = await snapshot();
    const key = SORTS[a.sortBy ?? 'apr'];
    const rows = filtered(snap.pools, { ...a, minTvlUsd: a.minTvlUsd ?? 100_000 }).sort((x, y) => key(y.p) - key(x.p)).slice(0, a.limit ?? 10);
    return text({ updatedAt: snap.updatedAt && new Date(snap.updatedAt).toISOString(), count: rows.length, pools: rows.map(({ p, risk }) => brief(p, risk)) });
  });

  server.registerTool('search_pools', {
    title: 'Search pools',
    description: 'Find pools by token symbols ("ETH USDC"), a token address, or a DEX name ("aerodrome"). Sorted by TVL.',
    inputSchema: z.object({ query: z.string().min(1), chain: chainArg, limit: z.number().int().min(1).max(50).optional().describe('Default 10.') }),
    annotations: READ,
  }, async (a) => {
    const { pools } = await snapshot();
    const c = a.chain ? chainKey(a.chain) : null;
    const hits = searchPools(pools, a.query).filter((p) => !c || chainKey(p.chain) === c).sort((x, y) => y.tvlUsd - x.tvlUsd);
    return text({ matches: hits.length, pools: hits.slice(0, a.limit ?? 10).map((p) => brief(p)) });
  });

  server.registerTool('pool_details', {
    title: 'Pool details and risk',
    description: 'Everything about one pool: TVL, APRs (measured range APR, base, rewards), volume, fees, in-range share, result against holding, both tokens\' safety scans, the risk grade with each deduction, and the btb.finance link.',
    inputSchema: z.object(poolArgs),
    annotations: READ,
  }, async (a) => {
    const p = await poolOr(a.chain, a.pool);
    return p ? text(await details(p)) : fail('Pool not found. Use search_pools or top_pools to get its key.');
  });

  server.registerTool('compare_pools', {
    title: 'Compare pools',
    description: 'Compare 2 to 6 pools side by side (APR, TVL, fees, risk with reasons, stable or not) and say which leads on each measure.',
    inputSchema: z.object({ pools: z.array(z.string()).min(2).max(6).describe('Pool keys, e.g. ["base:0x…", "ethereum:0x…"].') }),
    annotations: READ,
  }, async (a) => {
    const snap = await snapshot();
    const found = a.pools.map((k) => findPool(snap.pools, undefined, k));
    const missing = a.pools.filter((_, i) => !found[i]);
    if (missing.length) return fail(`Not found: ${missing.join(', ')}. Use keys from search_pools or top_pools.`);
    const rows = await Promise.all((found as EarnPool[]).map(details));
    const best = (f: (r: (typeof rows)[number]) => number) => rows.reduce((b, r) => (f(r) > f(b) ? r : b)).key;
    return text({
      pools: rows,
      leaders: {
        highestApr: best((r) => r.aprPct),
        lowestRisk: best((r) => r.riskScore),
        deepestTvl: best((r) => r.tvlUsd),
        mostFees24h: best((r) => r.fees24hUsd ?? 0),
        bestAprPerRisk: best((r) => r.aprPct * (r.riskScore / 100)),
      },
    });
  });

  server.registerTool('best_pools_for', {
    title: 'Best pools for an amount',
    description: 'The highest-APR pools that can take a position of this size without it being more than 2 % of the pool (TVL at least 50× the amount).',
    inputSchema: z.object({
      amountUsd: z.number().positive(), chain: chainArg, maxRisk: riskArg,
      stableOnly: z.boolean().optional(), limit: z.number().int().min(1).max(20).optional().describe('Default 5.'),
    }),
    annotations: READ,
  }, async (a) => {
    const { pools } = await snapshot();
    const rows = filtered(pools, { ...a, minTvlUsd: Math.max(100_000, a.amountUsd * 50) })
      .sort((x, y) => headlineApr(y.p) - headlineApr(x.p)).slice(0, a.limit ?? 5);
    return text({ amountUsd: a.amountUsd, pools: rows.map(({ p, risk }) => ({ ...brief(p, risk), yearlyEarnUsdAtApr: round2(a.amountUsd * headlineApr(p) / 100) })) });
  });

  server.registerTool('chain_summary', {
    title: 'Chain summary',
    description: 'Per chain: pool count, total TVL, median APR and TVL-weighted APR (all pools, and stable pairs only).',
    inputSchema: z.object({ chain: chainArg }),
    annotations: READ,
  }, async (a) => {
    const snap = await snapshot();
    const c = a.chain ? chainKey(a.chain) : null;
    const groups = new Map<string, EarnPool[]>();
    for (const p of snap.pools) if (!c || chainKey(p.chain) === c) groups.set(p.chain, [...(groups.get(p.chain) ?? []), p]);
    const sum = (ps: EarnPool[]) => {
      const tvl = ps.reduce((s, p) => s + p.tvlUsd, 0);
      return {
        pools: ps.length, tvlUsd: Math.round(tvl),
        medianAprPct: round2(median(ps.map(headlineApr)) ?? 0),
        tvlWeightedAprPct: tvl ? round2(ps.reduce((s, p) => s + headlineApr(p) * p.tvlUsd, 0) / tvl) : null,
      };
    };
    const chains = [...groups].sort((x, y) => y[1].length - x[1].length)
      .map(([chain, ps]) => ({ chain, all: sum(ps), stablePairs: sum(ps.filter((p) => p.stablecoin)) }));
    return chains.length ? text({ updatedAt: snap.updatedAt && new Date(snap.updatedAt).toISOString(), chains }) : fail(`No pools on "${a.chain}". Chains: ${snap.chains.join(', ')}.`);
  });

  server.registerTool('estimate_lp_earnings', {
    title: 'Estimate LP earnings',
    description: 'What an amount in one pool might earn over a number of days, from its APR and from its last 24 hours of fees, with the caveats.',
    inputSchema: z.object({ ...poolArgs, amountUsd: z.number().positive(), days: z.number().int().min(1).max(3650).optional().describe('Default 30.') }),
    annotations: READ,
  }, async (a) => {
    const p = await poolOr(a.chain, a.pool);
    return p ? text(estimate(p, a.amountUsd, a.days ?? 30)) : fail('Pool not found. Use search_pools or top_pools to get its key.');
  });

  server.registerTool('token_safety', {
    title: 'Token safety',
    description: 'The newest btb.finance safety scan of a token (score 0-100, honeypot, taxes, owner powers), if one ran in the last 24 hours, else a link to run one.',
    inputSchema: z.object({ chain: z.string().describe('Chain name or id.'), token: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe('Token address.') }),
    annotations: READ,
  }, async (a) => {
    const ids: Record<string, number> = { ethereum: 1, base: 8453, bnbchain: 56, robinhoodchain: 4663, arbitrum: 42161, optimism: 10, polygon: 137, unichain: 130 };
    const chainId = /^\d+$/.test(a.chain) ? Number(a.chain) : ids[chainKey(a.chain)] ?? null;
    const slug = ({ 1: 'ethereum', 8453: 'base', 56: 'bsc', 4663: 'robinhood' } as Record<number, string>)[chainId ?? 0] ?? chainSlug(a.chain);
    const g = await tokenGrade(chainId, a.token);
    return text(g ? { ...g, scannedAt: new Date(g.scannedAt).toISOString(), link: scanLink(slug, a.token) }
      : { scanned: false, note: 'No scan in the last 24 hours. Running one on btb.finance costs a little BTB; anyone can then read it free for 24 hours.', link: scanLink(slug, a.token) });
  });

  server.registerTool('lp_plan', {
    title: 'Plan an LP portfolio',
    description: 'Split an amount across several pools on different pairs (at most one pool per pair, no more than 2 % of any pool), within a risk limit, with expected yearly earnings and the cost of auto-management. A starting point for the user to review, not advice.',
    inputSchema: z.object({
      amountUsd: z.number().positive(), chain: chainArg,
      maxRisk: riskArg.describe('Worst risk grade to include. Default B.'),
      stableOnly: z.boolean().optional(),
      pools: z.number().int().min(1).max(8).optional().describe('How many pools to spread across. Default 3.'),
    }),
    annotations: READ,
  }, async (a) => {
    const { pools } = await snapshot();
    const n = a.pools ?? 3;
    const per = a.amountUsd / n;
    const seen = new Set<string>();
    const picks = filtered(pools, { chain: a.chain, maxRisk: a.maxRisk ?? 'B', stableOnly: a.stableOnly, minTvlUsd: Math.max(250_000, per * 50) })
      .sort((x, y) => headlineApr(y.p) * y.risk.score - headlineApr(x.p) * x.risk.score)
      .filter(({ p }) => { const k = p.pair.split('-').map((s) => s.toUpperCase()).sort().join('-'); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, n);
    if (!picks.length) return fail('No pools pass these limits. Allow a worse risk grade, another chain, or a smaller amount.');
    const each = a.amountUsd / picks.length;
    const rows = picks.map(({ p, risk }) => {
      const chainId = chainIdOf(p);
      const auto = chainId && REBALANCE_USD[chainId] ? { available: true, checkBtbPerDayHourly: dailyCheckBtb(60), rebalanceUsd: REBALANCE_USD[chainId] } : { available: false };
      return { ...brief(p, risk), allocateUsd: round2(each), yearlyEarnUsdAtApr: round2(each * headlineApr(p) / 100), autoManage: auto };
    });
    const yearly = rows.reduce((s, r) => s + r.yearlyEarnUsdAtApr, 0);
    return text({
      amountUsd: a.amountUsd, pools: rows,
      blendedAprPct: round2((yearly / a.amountUsd) * 100), yearlyEarnUsdAtApr: round2(yearly),
      nextSteps: ['Open each pool link and add liquidity with your own wallet (btb.finance shows the range and the transactions before you sign).',
        'Then turn on auto-management for each position (auto_manage_setup explains costs) so the range is reset when price leaves it.'],
      disclaimer: 'Estimates from current APRs, which change. Not financial advice.',
    });
  });

  server.registerTool('add_liquidity_link', {
    title: 'Add liquidity (link to sign)',
    description: 'A btb.finance link that opens the Add-liquidity flow for a pool, where the user picks the amount and range and signs in their own wallet. Says whether the app can add to this pool directly.',
    inputSchema: z.object({ ...poolArgs, amountUsd: z.number().positive().optional().describe('For the estimate shown with the link.') }),
    annotations: READ,
  }, async (a) => {
    const p = await poolOr(a.chain, a.pool);
    if (!p) return fail('Pool not found. Use search_pools or top_pools to get its key.');
    const { ok, dex } = addable(p);
    return text({
      pool: poolKey(p), pair: p.pair, chain: p.chain, link: poolLink(p), canAddOnBtb: ok, dex,
      feePct: feePct(p), risk: poolRisk(p).grade,
      steps: ok
        ? ['Open the link and connect your wallet.', 'Enter the amount; btb.finance suggests a range and shows the APR for it.', 'Review and sign the approval and mint transactions in your wallet.', 'Optional: turn on auto-management for the new position.']
        : ['btb.finance cannot add to this pool directly yet; the link opens its page with the simulator and the DEX\'s own page.'],
      estimate: a.amountUsd ? estimate(p, a.amountUsd, 30) : undefined,
      safety: 'Nothing is signed or sent by this tool. Check the pool, the tokens and the amounts in your wallet before signing.',
    });
  });

  server.registerTool('wallet_positions', {
    title: 'Wallet LP positions',
    description: 'Every LP position a wallet holds on Ethereum, Base, BNB Chain, Robinhood Chain and Arc (Uniswap V3/V4, PancakeSwap, Aerodrome, Aero, Giga, Ramses, UP, SushiSwap, Alandale), including the ones in its BTB smart wallets: pair, amounts, USD value, in range or not, price range, uncollected fees, staking, auto-management, and PnL when available. Public on-chain data, read-only. Takes up to about 20 seconds.',
    inputSchema: z.object({
      address: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe('The wallet address.'),
      chain: z.string().optional().describe('Only this chain (faster). Omit for all five.'),
    }),
    annotations: READ,
  }, async (a) => {
    const r = await walletPositions(a.address as `0x${string}`, a.chain);
    return text({ ...r, manageLink: portfolioLink(), note: 'Collect fees, add, remove or rebalance on btb.finance (Portfolio) with the wallet; nothing here can change a position.' });
  });

  server.registerTool('auto_manage_status', {
    title: 'Auto-managed positions',
    description: 'The LP positions a wallet has under BTB auto-management (automatic range resets and fee compounding): status, last in-range check, rebalances, costs and BTB balance. Read-only, public data.',
    inputSchema: z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe('The owner wallet address.') }),
    annotations: READ,
  }, async (a) => {
    const r = await convex().query(api.autoRebalance.listForAddress, { address: a.address });
    const iso = (t: number | null) => (t ? new Date(t).toISOString() : null);
    return text({
      address: a.address.toLowerCase(), btbBalance: r.balance, freeActionsLeft: r.freeActions,
      positions: r.jobs.map((j) => ({
        label: j.label, chainId: j.chainId, tokenId: j.tokenId, positionManager: j.positionManager, staked: !!j.gauge,
        active: j.active, status: j.status, note: j.note, lastInRange: j.lastInRange,
        checkEvery: intervalLabel(j.intervalMin), checkBtbPerDay: dailyCheckBtb(j.intervalMin),
        lastCheckedAt: iso(j.lastCheckedAt), lastRebalancedAt: iso(j.lastRebalancedAt), nextCheckAt: iso(j.nextCheckAt),
        checks: j.checks, rebalances: j.rebalances, compound: j.compound, compounds: j.compounds, spentBtb: j.spentBtb, rebalanceBtb: j.rebalanceBtb,
      })),
      manageLink: portfolioLink(),
      note: r.jobs.length ? 'Pause, stop or change the check interval on btb.finance (Portfolio) after signing in with the wallet.' : 'No auto-managed positions. See auto_manage_setup.',
    });
  });

  server.registerTool('auto_manage_setup', {
    title: 'Turn on auto-management',
    description: 'How BTB auto-management works, what it costs on each chain, and the link where the user turns it on for a position with their own wallet.',
    inputSchema: z.object({ chain: chainArg }),
    annotations: READ,
  }, async (a) => {
    const c = a.chain ? chainKey(a.chain) : null;
    const chains = Object.keys(REBALANCE_USD).map(Number).map((id) => ({
      chainId: id, chain: id === 8453 ? 'Base' : id === 4663 ? 'Robinhood Chain' : String(id),
      rebalanceUsd: REBALANCE_USD[id], rebalanceBtb: rebalanceBtb(id), compoundBtb: rebalanceBtb(id),
    })).filter((x) => !c || chainKey(x.chain) === c);
    return text({
      what: 'The position sits in a BTB smart wallet that you own. The BTB agent checks it on your schedule; when price leaves the range it moves the liquidity to a new range around the current price, and it can compound earned fees. The agent can only run the wallet\'s approved actions (rebalance, compound, stake) and only ever sends tokens back to you; withdrawing is yours alone.',
      chains: chains.length ? chains : `Auto-management runs on Base and Robinhood Chain; not on ${a.chain}.`,
      checks: { btbPerCheck: 1, intervals: CHECK_INTERVALS.map((m) => ({ every: intervalLabel(m), btbPerDay: dailyCheckBtb(m) })) },
      freeTrial: `The first ${FREE_ACTIONS} rebalances and compounds per owner are free, and checks are free while any are left.`,
      btbUsd: BTB_USD,
      steps: ['Open the link and connect your wallet.', 'Pick a position (or add one first with add_liquidity_link) and choose Auto-manage.', 'Pick the check interval and whether to compound fees, then sign the wallet setup in your wallet.', 'Check on it any time with auto_manage_status.'],
      link: portfolioLink(),
    });
  });

  const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
  const WRITE_PREP = { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true } as const;
  /** Adds a btb.finance sign link to a build result, so any AI app can hand the person something to sign. */
  type Sim = { status: string; reason?: string } | undefined;
  const withSignLink = <T extends { chainId: number; transactions: TxOut[] }>(r: T, title: string, wallet: string, sims: Sim[] = [], swap?: SignStep['swap']) => {
    const steps: SignStep[] = r.transactions.map((t, i) => {
      const sim = sims[i];
      // A later step that reverts only because an earlier approval is not on chain yet is expected.
      const waits = sim?.status === 'skipped' || (sim?.status === 'reverted' && i > 0);
      return {
        label: t.label, to: t.to, data: t.data, value: t.value,
        ...(sim ? { dryRun: sim.status === 'passed' ? 'passed' : waits ? 'after-previous' : sim.status, dryRunNote: sim.reason } : { dryRun: 'none' }),
        // The swap itself (last step) is re-quoted on the sign page if it is signed later than a minute after now.
        ...(swap && i === r.transactions.length - 1 ? { swap, builtAt: Date.now() } : {}),
      };
    });
    const link = signLink({ title, chainId: r.chainId, wallet, steps });
    return link
      ? { ...r, signLink: link, signLinkNote: 'For a person: give them this link. It opens btb.finance with these steps to sign in their own wallet, in order. Valid 15 minutes, only for this wallet.' }
      : r;
  };

  const failWith = (e: unknown) => {
    const err = e as Error & { link?: string };
    return fail(err.link ? `${err.message} Link: ${err.link}` : err.message ?? String(e));
  };

  server.registerTool('find_token', {
    title: 'Find a token address',
    description: 'A token\'s contract address on one chain, by symbol, name or address, with decimals and USD price: first the swap catalog btb.finance uses (verified tokens first), then any token trading on a DEX (most liquid first). Use it before quoting, swapping or reading a balance; never write a token address from memory. "ETH" is the native coin.',
    inputSchema: z.object({
      query: z.string().describe('Symbol, name or address, e.g. "USDC", "ezETH", "PONS".'),
      chain: z.string().optional().describe('Chain name or id, e.g. "base", "ethereum", "bnb", "robinhood", 8453. Omit to search every main chain at once.'),
    }),
    annotations: READ,
  }, async (a) => {
    try {
      if (a.chain) return text(await findToken(a.query, a.chain));
      // Every main chain in one call: where a token lives is often the question.
      const chains = ['ethereum', 'base', 'bnb', 'arbitrum', 'optimism', 'polygon', 'unichain', 'robinhood'];
      const found = await Promise.all(chains.map((c) => findToken(a.query, c).catch(() => null)));
      const hits = found.flatMap((f) => (f?.tokens.length ? [{ chainId: f.chainId, tokens: f.tokens, ...('note' in f && f.note ? { note: f.note } : {}) }] : []));
      return text({ query: a.query, chains: hits, ...(hits.length ? {} : { note: `No token "${a.query}" on ${chains.join(', ')}. Ask for the contract address and chain.` }) });
    } catch (e) { return failWith(e); }
  });

  server.registerTool('quote_swap', {
    title: 'Swap quote',
    description: 'A live quote at the best KyberSwap route, after the 1% BTB fee: what an amount of one token gets of another, both sides in USD, rate, price impact, gas, and a warning when the pool is thin for the size. Read-only; use build_swap to get the transactions, or give the swapLink to a person.',
    inputSchema: z.object({
      chain: z.string().describe('Chain name or id.'),
      tokenIn: z.string().describe('Token sold: address from find_token, or "ETH" for the native coin.'),
      tokenOut: z.string().describe('Token bought: address, or "ETH".'),
      amount: z.string().regex(/^\d+(\.\d+)?$/).describe('Amount of tokenIn in whole units, e.g. "1" or "0.25".'),
    }),
    annotations: READ,
  }, async (a) => {
    try { return text(await quoteSwap(a)); } catch (e) { return failWith(e); }
  });

  server.registerTool('wallet_tokens', {
    title: 'Wallet token balances',
    description: 'The tokens a wallet holds, read from chain now, on Ethereum, Base, BNB Chain, Arbitrum, Optimism, Polygon, Unichain and Robinhood Chain (or one chain), with USD values, newest-listed tokens included. Pass search (a symbol, name or address) to find one token across chains, e.g. before "sell all my X". Public data, read-only. Takes up to about 15 seconds.',
    inputSchema: z.object({
      wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe('The wallet address.'),
      chain: z.string().optional().describe('Only this chain (faster).'),
      search: z.string().optional().describe('Only this token: symbol, name or address.'),
      minUsd: z.number().min(0).optional().describe('Hide holdings worth less than this. Default 0.'),
    }),
    annotations: READ,
  }, async (a) => {
    try { return text(await walletTokens(a)); } catch (e) { return failWith(e); }
  });

  server.registerTool('lending_rates', {
    title: 'Lending and savings rates',
    description: 'Live supply APYs for lending a token on Aave, Compound, Morpho, Spark, Euler, Fluid, Moonwell, Venus and more, per chain, best first, with TVL and the 30-day average. Filter by token (symbol or address, "stable" for all stablecoins), chain and protocol. Use it for "where do I earn most on my USDC" and before suggesting any lending; never guess a rate.',
    inputSchema: z.object({
      token: z.string().optional().describe('Symbol or address, e.g. "USDC", "ETH", or "stable".'),
      chain: z.string().optional().describe('Chain name or id. Omit for all chains.'),
      protocol: z.string().optional().describe('e.g. "aave", "morpho", "compound".'),
      minTvlUsd: z.number().min(0).optional().describe('Skip smaller markets. Default 1000000.'),
      limit: z.number().int().min(1).max(50).optional().describe('Default 15.'),
    }),
    annotations: READ,
  }, async (a) => {
    try { return text(await lendingRates(a)); } catch (e) { return failWith(e); }
  });

  server.registerTool('tx_status', {
    title: 'Transaction status',
    description: 'Whether a transaction confirmed or failed, its fee, and the tokens that moved in and out of the sending wallet. Use it after a person signs (they can paste the hash, or the sign page shows it).',
    inputSchema: z.object({
      chain: z.string().describe('Chain name or id.'),
      hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).describe('Transaction hash.'),
    }),
    annotations: READ,
  }, async (a) => {
    try { return text(await txStatus(a)); } catch (e) { return failWith(e); }
  });

  const lendArgs = {
    chain: z.string().describe('Chain name or id: ethereum, base, arbitrum, optimism, polygon, avalanche, bnb.'),
    token: z.string().describe('Symbol or address, e.g. "USDC", "WETH". Aave takes the wrapped coin, not native ETH.'),
    wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe('The wallet that lends and signs.'),
  };

  server.registerTool('build_lend', {
    title: 'Lend on Aave (ready to sign)',
    description: 'Lend a token on Aave V3: the exact approval only if needed, then the supply, as ONE signLink for the person, with the live supply APY, what the amount earns a year, the wallet\'s health factor and a dry run. Use this, not build_tx, for Aave deposits.',
    inputSchema: z.object({ ...lendArgs, amount: z.string().regex(/^(\d+(\.\d+)?|max)$/).describe('Whole units, e.g. "10", or "max" for the whole balance.') }),
    annotations: WRITE_PREP,
  }, async (a) => {
    try {
      const r = await buildLend(a);
      const sims: Sim[] = r.transactions.map((_, i) => (i === r.transactions.length - 1 ? r.simulation : undefined));
      return text(withSignLink(r, `Lend ${r.amount} ${r.token.symbol} on Aave`, a.wallet, sims));
    } catch (e) { return failWith(e); }
  });

  server.registerTool('build_withdraw', {
    title: 'Withdraw from Aave (ready to sign)',
    description: 'Take a lent token back from Aave V3, as a signLink for the person: how much is supplied, how much can be withdrawn right now, the health factor (if the wallet borrows) and a dry run. amount "max" takes everything including interest.',
    inputSchema: z.object({ ...lendArgs, amount: z.string().regex(/^(\d+(\.\d+)?|max)$/).describe('Whole units, or "max" for all of it.') }),
    annotations: WRITE_PREP,
  }, async (a) => {
    try {
      const r = await buildWithdraw(a);
      return text(withSignLink(r, `Withdraw ${r.token.symbol} from Aave`, a.wallet, [r.simulation]));
    } catch (e) { return failWith(e); }
  });

  server.registerTool('staking_rates', {
    title: 'ETH staking rates',
    description: 'What ETH earns staked through each liquid-staking token (Lido stETH/wstETH, ether.fi weETH, Rocket Pool rETH, Coinbase cbETH, Binance wBETH, Kelp, Renzo...), best first, with TVL and the 30-day average. Use it for "where do I get the best staking APR" and to add the staking yield to pools that hold these tokens.',
    inputSchema: z.object({ token: z.string().optional().describe('Only this token or protocol, e.g. "wstETH", "rETH", "lido".') }),
    annotations: READ,
  }, async (a) => {
    try { return text(await stakingRates(a)); } catch (e) { return failWith(e); }
  });

  server.registerTool('quick_token_check', {
    title: 'Free token check',
    description: 'A free basic safety check of any token (GoPlus): honeypot, buy and sell tax, owner can mint or change balances, blacklist, pausable transfers, proxy, verified source, holders. Use it when token_safety has no recent scan; it is not as deep as a btb.finance scan.',
    inputSchema: z.object({
      chain: z.string().describe('Chain name or id.'),
      token: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe('Token address.'),
    }),
    annotations: READ,
  }, async (a) => {
    try { return text(await quickTokenCheck(a)); } catch (e) { return failWith(e); }
  });

  server.registerTool('build_zap_liquidity', {
    title: 'Add liquidity from one token (ready to sign)',
    description: 'Open a concentrated-liquidity position using only ONE of the pool\'s tokens: swaps the right share into the other token at the best price, then deposits both for the chosen range, as ONE signLink (swap, approvals, deposit). A small safety margin of the other token is left in the wallet. Same pools as build_add_liquidity (Uniswap V3, PancakeSwap V3, Aerodrome Slipstream and the V3 forks btb.finance supports).',
    inputSchema: z.object({
      ...poolArgs,
      token: z.string().describe('The one token you have: the pool token\'s symbol or address (wrapped symbol for ETH, e.g. WETH).'),
      amount: z.string().regex(/^\d+(\.\d+)?$/).describe('How much of it to put in, in whole units.'),
      wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe('The wallet that signs.'),
      rangePct: z.number().positive().max(500).nullable().optional().describe('Half-width of the range in %, e.g. 5. null = full range. Default 5.'),
      slippageBps: z.number().int().min(1).max(3000).optional(),
    }),
    annotations: WRITE_PREP,
  }, async (a) => {
    const p = await poolOr(a.chain, a.pool);
    if (!p) return fail('Pool not found. Use search_pools or top_pools to get its key.');
    try {
      const r = await buildZapLiquidity(p, { wallet: a.wallet as `0x${string}`, token: a.token, amount: a.amount, rangePct: a.rangePct, slippageBps: a.slippageBps });
      const { sims, ...rest } = r as typeof r & { sims?: Sim[] };
      return text(withSignLink(rest, `Add ${a.amount} ${a.token} to ${p.pair}`, a.wallet, sims ?? []));
    } catch (e) { return failWith(e); }
  });

  server.registerTool('build_swap', {
    title: 'Build a swap (unsigned)',
    description: 'A swap ready to sign: the best KyberSwap price on that chain, an exact-amount approval if needed, then the swap, with the quote, price impact, BTB fee, a safety grade for the token bought and a dry run. For a person, give them the signLink (opens btb.finance with the steps to sign in their wallet); an agent with its own wallet can sign the transactions itself. Use this, not just quote_swap, whenever someone wants to swap.',
    inputSchema: z.object({
      chain: z.string().describe('Chain name or id, e.g. "base", "ethereum", "bnb", "arbitrum", 8453.'),
      tokenIn: z.string().describe('Token to sell: its address, or "ETH" for the chain\'s native coin.'),
      tokenOut: z.string().describe('Token to buy: its address, or "ETH" for the native coin.'),
      amount: z.string().regex(/^(\d+(\.\d+)?|max)$/).describe('Amount of tokenIn in whole units, e.g. "250" or "0.5", or "max" for the wallet\'s whole balance of a token (not the native coin, which also pays gas).'),
      wallet: addr.describe('The wallet that signs and pays.'),
      recipient: addr.optional().describe('Who receives tokenOut. Default: wallet.'),
      slippageBps: z.number().int().min(1).max(3000).optional().describe('Slippage tolerance in bps. Default 50 (0.5%).'),
    }),
    annotations: WRITE_PREP,
  }, async (a) => {
    try {
      let amount = a.amount;
      if (amount === 'max') {
        if (/^eth$/i.test(a.tokenIn)) return fail('"max" is for tokens: the native coin also pays gas, so give an amount.');
        const id = tokenChainId(a.chain);
        if (!id) return fail(`Unknown chain "${a.chain}".`);
        amount = await fullBalance(id, a.tokenIn, a.wallet as `0x${string}`);
      }
      const r = await buildSwap({ ...a, amount, wallet: a.wallet as `0x${string}`, recipient: a.recipient as `0x${string}` | undefined });
      const sims: Sim[] = r.transactions.map((_, i) => (i === r.transactions.length - 1 ? r.simulation : undefined));
      const out = withSignLink(r, `Swap ${r.quote.amountIn} ${r.quote.symbolIn} for ${r.quote.symbolOut}`, a.wallet, sims,
        { chainId: r.chainId, tokenIn: a.tokenIn, tokenOut: a.tokenOut, amount, slippageBps: r.quote.slippageBps });
      return text(out);
    }
    catch (e) { return failWith(e); }
  });

  server.registerTool('build_add_liquidity', {
    title: 'Build an LP deposit (unsigned)',
    description: 'For agents with their own wallet: the unsigned transactions to open a concentrated-liquidity position in a pool (exact-amount approvals if needed, then the mint), sized from an amount of one of its tokens, with the matching amount of the other token, the range, wallet balances and a dry run. Works for Uniswap V3, PancakeSwap V3, Aerodrome Slipstream and the V3 forks btb.finance supports; other pools return a link. Nothing is signed or sent.',
    inputSchema: z.object({
      ...poolArgs,
      wallet: addr.describe('The wallet that signs, pays and receives the position.'),
      token: z.string().describe('Which of the pool\'s two tokens `amount` is in: its address or symbol (wrapped symbol for ETH, e.g. WETH).'),
      amount: z.string().regex(/^\d+(\.\d+)?$/).describe('Amount of that token in whole units. The other token\'s amount is computed for the range.'),
      rangePct: z.number().positive().max(500).nullable().optional().describe('Half-width of the range around the price in %, e.g. 5 for ±5 %. null = full range. Default 5.'),
      slippageBps: z.number().int().min(1).max(3000).optional().describe('Slippage tolerance in bps. Default 50 (500 on Robinhood Chain).'),
    }),
    annotations: WRITE_PREP,
  }, async (a) => {
    const p = await poolOr(a.chain, a.pool);
    if (!p) return fail('Pool not found. Use search_pools or top_pools to get its key.');
    try {
      const r = await buildAddLiquidity(p, { wallet: a.wallet as `0x${string}`, token: a.token, amount: a.amount, rangePct: a.rangePct, slippageBps: a.slippageBps });
      const sims: Sim[] = r.transactions.map((_, i) => (i === r.transactions.length - 1 ? r.simulation : undefined));
      return text(withSignLink(r, `Add liquidity to ${p.pair}`, a.wallet, sims));
    }
    catch (e) { return failWith(e); }
  });

  const chainReq = z.string().describe('Chain name or id, e.g. "ethereum", "base", "arbitrum", "bnb", 8453.');
  const fnArg = z.string().describe('Function name (e.g. "balanceOf"), full signature for overloads ("supply(address,uint256,address,uint16)") or 4-byte selector.');
  const argsArg = z.array(z.any()).default([]).describe('Arguments in order. Integers as strings in base units ("5000000000" for 5,000 USDC), addresses as 0x strings, tuples as objects or arrays, "max" for the largest uint.');

  server.registerTool('get_abi', {
    title: 'Contract functions (ABI)',
    description: 'What any contract can do: its functions with signatures, inputs, outputs, read or write, and warning flags (admin-likely, arbitrary-call). From verified source on Sourcify, or decoded from the deployed bytecode when unverified; proxies are followed to their implementation. Works on any chain BTB has an RPC for.',
    inputSchema: z.object({
      chain: chainReq,
      address: z.string().describe('The contract address.'),
      kind: z.enum(['read', 'write', 'all']).optional().describe('Only read or only write functions. Default all.'),
      search: z.string().optional().describe('Only functions whose signature contains this text, e.g. "borrow".'),
      full: z.boolean().optional().describe('Also return the raw ABI JSON. Default false.'),
    }),
    annotations: READ,
  }, async (a) => {
    try { return text(await abiSummary(a.chain, a.address, a)); } catch (e) { return failWith(e); }
  });

  server.registerTool('read_contract', {
    title: 'Read a contract',
    description: 'Call a read (view/pure) function on any contract and get the decoded result: balances, prices, positions, settings. Free, nothing is sent.',
    inputSchema: z.object({ chain: chainReq, address: z.string().describe('The contract address.'), function: fnArg, args: argsArg }),
    annotations: READ,
  }, async (a) => {
    try { return text(await readContract(a.chain, a.address, a.function, a.args)); } catch (e) { return failWith(e); }
  });

  server.registerTool('build_tx', {
    title: 'Build any contract call (unsigned)',
    description: 'Turn contract calls into transactions to sign, with a dry run and warnings. When an action needs an approval first (lend on Aave, stake, deposit), pass steps: [approve on the token, then the action] in ONE call so the person gets ONE signLink for both; never build them as separate calls. Single call: address and function. Details: encode any write function of any contract into an unsigned transaction, with a dry run from the wallet, a gas estimate and warnings (unverified ABI, admin-only, arbitrary calls, proxies, unlimited approvals). Prefer build_swap and build_add_liquidity where they apply: they add the protocol math and approvals. Nothing is signed or sent.',
    inputSchema: z.object({
      chain: chainReq,
      address: z.string().optional().describe('The contract to call (one call). For several calls in order, use steps instead.'),
      function: fnArg.optional(),
      args: argsArg,
      wallet: addr.describe('The wallet that will sign and send.'),
      valueEth: z.string().regex(/^\d+(\.\d+)?$/).optional().describe('Native coin to send with the call, in whole units (payable functions only).'),
      steps: z.array(z.object({
        address: z.string().describe('The contract to call.'),
        function: fnArg,
        args: argsArg,
        valueEth: z.string().regex(/^\d+(\.\d+)?$/).optional(),
      })).min(1).max(6).optional().describe('Several calls signed in order, e.g. [approve on the token, supply on the pool]: one signLink for all. Use instead of address/function.'),
      title: z.string().max(80).optional().describe('What the steps do, shown on the sign page, e.g. "Lend 10 USDC on Aave".'),
    }),
    annotations: WRITE_PREP,
  }, async (a) => {
    try {
      const calls = a.steps ?? (a.address && a.function ? [{ address: a.address, function: a.function, args: a.args, valueEth: a.valueEth }] : null);
      if (!calls) return fail('Give address and function for one call, or steps for several.');
      const built = [];
      for (const c of calls) built.push(await buildTx({ chain: a.chain, address: c.address, fn: c.function, args: c.args ?? [], wallet: a.wallet, valueEth: c.valueEth }));
      const transactions = built.flatMap((b) => b.transactions).map((t, i) => ({ ...t, step: i + 1 }));
      const merged = built.length === 1 ? built[0] : {
        chainId: built[0].chainId,
        steps: built.map((b, i) => ({ step: i + 1, contract: b.contract, function: b.function, args: b.args, abiSource: b.abiSource, simulation: b.simulation, warnings: b.warnings })),
        transactions,
        notes: ['Sign and send in step order; a later step\'s dry run can fail only because an earlier approval is not on chain yet.', 'Nothing was signed or sent. Not financial advice.'],
      };
      const title = a.title ?? (built.length === 1 ? `Call ${built[0].function}` : `${built.length} steps on chain ${built[0].chainId}`);
      // An approval on its own does nothing useful: say so, so the agent rebuilds with the action in the same link.
      const approvalOnly = built.length === 1 && /^(approve|increaseAllowance)\(/.test(built[0].function ?? '')
        ? { approvalOnly: 'This link holds only the approval. Rebuild with steps: [this approve, the action that spends it] so the person signs both from one link.' } : {};
      return text({ ...withSignLink({ ...merged, chainId: built[0].chainId, transactions }, title, a.wallet, built.map((b) => b.simulation)), ...approvalOnly });
    } catch (e) { return failWith(e); }
  });

  server.registerTool('list_protocols', {
    title: 'Protocols in the BTB registry',
    description: 'DeFi protocols BTB has researched for agents (stablecoin issuers, DEXes, lending, staking, prediction markets, perps…), filterable by category, chain or text: name, category, chains, how agents access it (on-chain or API) and how many contracts and APIs are recorded.',
    inputSchema: z.object({
      category: z.string().optional().describe('e.g. "Liquid Staking", "Dexs", "Lending", "Stablecoin".'),
      chain: z.string().optional().describe('Only protocols on this chain, e.g. "base", "ethereum", "solana".'),
      search: z.string().optional().describe('Text in the name or description.'),
    }),
    annotations: READ,
  }, async (a) => text(listProtocols(a)));

  server.registerTool('get_protocol', {
    title: 'Protocol contracts, functions and APIs',
    description: 'One protocol from the BTB registry: its official contract addresses per chain (each with the official page it came from), the functions an agent would call, off-chain APIs, supported actions and risks. Then use get_abi / read_contract / build_tx on its contracts.',
    inputSchema: z.object({
      protocol: z.string().describe('Name or slug, e.g. "lido", "uniswap", "maple-finance".'),
      chain: z.string().optional().describe('Only contracts on this chain.'),
    }),
    annotations: READ,
  }, async (a) => {
    const d = protocolDetail(a.protocol, a.chain);
    return d ? text(d) : fail(`"${a.protocol}" is not in the BTB registry yet. Use list_protocols to see what is, or get_abi on a contract address directly.`);
  });

  return server;
}
