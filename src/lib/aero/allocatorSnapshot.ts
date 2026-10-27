/**
 * The Allocate page's shared data: every Aero gauge on Base with what it pays per day, built once an hour by
 * convex/aeroAllocator.ts and read by every visitor from one row. Kept apart from allocator.ts because it fetches prices
 * and reads event logs, which only the server job does.
 */
import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { base } from 'viem/chains';
import { llamaPrices } from '../tvlCheck';
import {
  AERO, DEFAULT_COOLDOWN_SEC, LEDGER_HOURS, feePace, leafVoterAbi, notifyFeesEvent, pruneLedger, readGauges,
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
/** Public Base nodes take at most 10 addresses and 10,000 blocks per log query. */
const ADDRS_PER_QUERY = 10;
const BLOCKS_PER_QUERY = 9_999n;

async function retry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
}

/** A client that only reads logs, from the node known to take address lists (the app's tested lists rarely include one). */
export function baseLogClient(): PublicClient {
  return createPublicClient({ chain: base, transport: http('https://base-rpc.publicnode.com', { timeout: 30_000 }) }) as PublicClient;
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
): Promise<FeeLedger> {
  const head = await logClient.getBlockNumber();
  const nowSec = Math.floor(Date.now() / 1000);
  const hourOf = (block: bigint) => Math.floor((nowSec - Number(head - block) * BLOCK_SEC) / 3600);
  const backfill = BigInt(Math.round((LEDGER_HOURS * 3600) / BLOCK_SEC));
  const from = ledger && head - BigInt(ledger.lastBlock) < backfill ? BigInt(ledger.lastBlock) + 1n : head - backfill;
  const next: FeeLedger = ledger && from === BigInt(ledger.lastBlock) + 1n
    ? { lastBlock: ledger.lastBlock, hours: { ...ledger.hours }, first: { ...ledger.first } }
    : { lastBlock: 0, hours: {}, first: {} };
  if (from > head) return next;

  const gaugeOfRewards = new Map(gauges.map((g) => [g.rewards.toLowerCase(), g.gauge.toLowerCase()]));
  const rewards = gauges.map((g) => g.rewards);
  const jobs: { addrs: Address[]; f: bigint; t: bigint }[] = [];
  for (let i = 0; i < rewards.length; i += ADDRS_PER_QUERY) {
    for (let f = from; f <= head; f += BLOCKS_PER_QUERY + 1n) {
      jobs.push({ addrs: rewards.slice(i, i + ADDRS_PER_QUERY), f, t: f + BLOCKS_PER_QUERY > head ? head : f + BLOCKS_PER_QUERY });
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

/** Reads every gauge, updates the fee record and returns both, ready to save. */
export async function buildSnapshot(client: PublicClient, logClient: PublicClient, ledger: FeeLedger | null): Promise<{ snapshot: AllocatorSnapshot; ledger: FeeLedger }> {
  const nowSec = Math.floor(Date.now() / 1000);
  const gauges = await readGauges(client, nowSec);

  // Fee tokens are the pools' two tokens; incentive tokens can be anything.
  const tokens = new Set<string>([AERO.aero.toLowerCase()]);
  for (const g of gauges) {
    tokens.add(g.token0.toLowerCase()); tokens.add(g.token1.toLowerCase());
    for (const p of g.incentives) tokens.add(p.token.toLowerCase());
  }
  const prices = await llamaPrices([...tokens].map((t) => `base:${t}`));
  const priceOf = (t: string) => {
    const c = prices.get(`base:${t.toLowerCase()}`);
    return c && (c.price ?? 0) > 0 && c.decimals != null && (c.confidence ?? 1) >= 0.8 ? { price: c.price!, decimals: c.decimals } : null;
  };
  const usd = (t: string, raw: bigint) => { const p = priceOf(t); return p ? (Number(raw) / 10 ** p.decimals) * p.price : 0; };

  const nextLedger = await updateLedger(logClient, ledger, gauges, usd);
  const nowHour = Math.floor(nowSec / 3600);
  const cooldownSec = await client.readContract({ address: AERO.leafVoter, abi: leafVoterAbi, functionName: 'allocationCooldown' })
    .then(Number).catch(() => DEFAULT_COOLDOWN_SEC);

  const out: SnapGauge[] = gauges.map(({ incentives, ...g }) => {
    const key = g.gauge.toLowerCase();
    const pace = feePace(nextLedger.hours[key], nextLedger.first[key], nowHour);
    const incentivesPerDay = incentives.reduce((s, p) => {
      const pr = priceOf(p.token);
      return pr ? s + ((p.perSec * 86_400) / 10 ** pr.decimals) * pr.price : s;
    }, 0);
    return { ...g, feesPerDay: pace?.usdPerDay ?? null, feeHours: pace?.hours ?? 0, incentivesPerDay };
  });
  return {
    snapshot: { generatedAt: Date.now(), aeroUsd: priceOf(AERO.aero)?.price ?? null, cooldownSec, gauges: out },
    ledger: nextLedger,
  };
}
