/**
 * The Allocate page's shared data: every Aero gauge on Base with what it pays per day, built once an hour by
 * convex/aeroAllocator.ts and read by every visitor from one row. Kept apart from allocator.ts because it fetches prices
 * and reads event logs, which only the server job does.
 */
import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { base } from 'viem/chains';
import { llamaPrices } from '../tvlCheck';
import {
  AERO, AERO_CHAIN_ID, DEFAULT_COOLDOWN_SEC, LEDGER_HOURS, type AeroChain, feePace, leafVoterAbi, notifyFeesEvent, pruneLedger, readGauges,
  type FeeLedger, type GaugeInfo,
} from './allocator';

export type SnapGauge = Omit<GaugeInfo, 'incentives'> & {
  /** Trading fees released to allocators, USD per day at the recent pace; null when there is too little history. */
  feesPerDay: number | null;
  /** Hours of history the fee pace rests on. */
  feeHours: number;
  /** Incentives streaming now, USD per day (unpriced tokens count as 0). */
  incentivesPerDay: number;
};

export type AllocatorSnapshot = {
  generatedAt: number;
  aeroUsd: number | null;
  cooldownSec: number;
  gauges: SnapGauge[];
};

/** Base makes a block every 2 seconds. */
const BLOCK_SEC = 2;

async function retry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
}

/**
 * Where each chain's fee releases are read, and what that node accepts: blocks and contracts per log query, and how far a
 * first run reaches back. Public nodes differ a lot (publicnode takes 10 addresses but serves Ethereum and OP logs only
 * from recent blocks; Arbitrum's and Ink's own nodes serve older ones; Robinhood's takes wide ranges), so these were found
 * by trying them (2026-10-23 to 27).
 */
export type LogSource = { url: string; span: number; addrs: number; backfillHours: number };
export const LOG_SOURCES: Record<number, LogSource> = {
  8453: { url: 'https://base-rpc.publicnode.com', span: 9_999, addrs: 10, backfillHours: LEDGER_HOURS },
  1: { url: 'https://ethereum.reth.rs/rpc', span: 9_999, addrs: 10, backfillHours: LEDGER_HOURS },
  10: { url: 'https://mainnet.optimism.io', span: 9_999, addrs: 10, backfillHours: LEDGER_HOURS },
  42161: { url: 'https://arb1.arbitrum.io/rpc', span: 9_000, addrs: 15, backfillHours: 24 },
  57073: { url: 'https://rpc-qnd.inkonchain.com', span: 9_000, addrs: 5, backfillHours: 24 },
  4663: { url: 'https://rpc.mainnet.chain.robinhood.com', span: 50_000, addrs: 20, backfillHours: 24 },
};

/** A client that only reads logs, from the node that takes address lists on that chain. */
export function logClientFor(chainId: number): PublicClient {
  return createPublicClient({ ...(chainId === 8453 ? { chain: base } : {}), transport: http(LOG_SOURCES[chainId].url, { timeout: 30_000 }) }) as PublicClient;
}
export const baseLogClient = () => logClientFor(8453);

/** Seconds per block, measured over the last 10,000 blocks (Arbitrum and Robinhood run off their nominal pace). */
async function blockSecOf(c: PublicClient): Promise<number> {
  const head = await c.getBlock();
  const back = await c.getBlock({ blockNumber: head.number - 10_000n });
  return Math.max(0.01, Number(head.timestamp - back.timestamp) / 10_000);
}

/**
 * Brings the fee record up to the chain head: every fee release since its last block (the last day and a half on a first
 * run), priced now and added to the hour it happened in.
 */
export async function updateLedger(
  logClient: PublicClient,
  ledger: FeeLedger | null,
  gauges: GaugeInfo[],
  usd: (token: string, raw: bigint) => number,
  src: LogSource = LOG_SOURCES[8453],
): Promise<FeeLedger> {
  const head = await logClient.getBlockNumber();
  const blockSec = await blockSecOf(logClient).catch(() => BLOCK_SEC);
  const nowSec = Math.floor(Date.now() / 1000);
  const hourOf = (block: bigint) => Math.floor((nowSec - Number(head - block) * blockSec) / 3600);
  const backfill = BigInt(Math.round((src.backfillHours * 3600) / blockSec));
  const from = ledger && head - BigInt(ledger.lastBlock) < backfill ? BigInt(ledger.lastBlock) + 1n : head - backfill;
  const next: FeeLedger = ledger && from === BigInt(ledger.lastBlock) + 1n
    ? { lastBlock: ledger.lastBlock, hours: { ...ledger.hours }, first: { ...ledger.first } }
    : { lastBlock: 0, hours: {}, first: {} };
  if (from > head) return next;

  const gaugeOfRewards = new Map(gauges.map((g) => [g.rewards.toLowerCase(), g.gauge.toLowerCase()]));
  const rewards = gauges.map((g) => g.rewards);
  const jobs: { addrs: Address[]; f: bigint; t: bigint }[] = [];
  const span = BigInt(src.span);
  for (let i = 0; i < rewards.length; i += src.addrs) {
    for (let f = from; f <= head; f += span + 1n) {
      jobs.push({ addrs: rewards.slice(i, i + src.addrs), f, t: f + span > head ? head : f + span });
    }
  }
  let k = 0;
  const worker = async () => {
    while (k < jobs.length) {
      const job = jobs[k++];
      const logs = await retry(() => logClient.getLogs({ address: job.addrs, event: notifyFeesEvent, fromBlock: job.f, toBlock: job.t }));
      for (const l of logs) {
        const gauge = gaugeOfRewards.get(l.address.toLowerCase());
        if (!gauge || !l.args._token || l.args._amount == null) continue;
        const h = hourOf(l.blockNumber);
        const byHour = (next.hours[gauge] = { ...next.hours[gauge] });
        byHour[h] = (byHour[h] ?? 0) + usd(l.args._token, l.args._amount);
        if (next.first[gauge] == null || h < next.first[gauge]) next.first[gauge] = h;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, worker));
  next.lastBlock = Number(head);
  // A gauge first seen on a backfill was already paying before the record began, so its "first" release is just the
  // start of the record, which feePace already skips.
  return pruneLedger(next, Math.floor(nowSec / 3600));
}

/** One chain's gauges with what they pay, and its updated fee record. */
export async function buildChain(
  chain: AeroChain,
  client: PublicClient,
  logClient: PublicClient,
  ledger: FeeLedger | null,
): Promise<{ gauges: SnapGauge[]; ledger: FeeLedger; aeroUsd: number | null }> {
  const nowSec = Math.floor(Date.now() / 1000);
  const gauges = await readGauges(client, nowSec, chain);

  // Fee tokens are the pools' two tokens; incentive tokens can be anything.
  const tokens = new Set<string>(chain.id === AERO_CHAIN_ID ? [AERO.aero.toLowerCase()] : []);
  for (const g of gauges) {
    tokens.add(g.token0.toLowerCase()); tokens.add(g.token1.toLowerCase());
    for (const p of g.incentives) tokens.add(p.token.toLowerCase());
  }
  const prices = await llamaPrices([...tokens].map((t) => `${chain.llama}:${t}`));
  const priceOf = (t: string) => {
    const c = prices.get(`${chain.llama}:${t.toLowerCase()}`);
    return c && (c.price ?? 0) > 0 && c.decimals != null && (c.confidence ?? 1) >= 0.8 ? { price: c.price!, decimals: c.decimals } : null;
  };
  const usd = (t: string, raw: bigint) => { const p = priceOf(t); return p ? (Number(raw) / 10 ** p.decimals) * p.price : 0; };

  const nextLedger = await updateLedger(logClient, ledger, gauges, usd, LOG_SOURCES[chain.id]);
  const nowHour = Math.floor(nowSec / 3600);
  const out: SnapGauge[] = gauges.map(({ incentives, ...g }) => {
    const key = g.gauge.toLowerCase();
    const pace = feePace(nextLedger.hours[key], nextLedger.first[key], nowHour);
    const incentivesPerDay = incentives.reduce((sum, p) => {
      const pr = priceOf(p.token);
      return pr ? sum + ((p.perSec * 86_400) / 10 ** pr.decimals) * pr.price : sum;
    }, 0);
    return { ...g, feesPerDay: pace?.usdPerDay ?? null, feeHours: pace?.hours ?? 0, incentivesPerDay };
  });
  return { gauges: out, ledger: nextLedger, aeroUsd: chain.id === AERO_CHAIN_ID ? priceOf(AERO.aero)?.price ?? null : null };
}

/** The cooldown, read on Base. */
export async function readCooldown(client: PublicClient): Promise<number> {
  return client.readContract({ address: AERO.leafVoter, abi: leafVoterAbi, functionName: 'allocationCooldown' })
    .then(Number).catch(() => DEFAULT_COOLDOWN_SEC);
}
