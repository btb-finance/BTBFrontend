/**
 * Aero allocator: where a sAERO position earns the most on Base.
 *
 * Since 2026-10-22 Aero (the merged Aerodrome and Velodrome) has no weekly vote. A sAERO position allocates its power to
 * gauges and earns, continuously, a share of what each gauge pays: the trading fees of its pool's staked liquidity plus any
 * incentives streaming to it. A position can change its allocation once per cooldown (47 hours at launch).
 *
 * Contract facts are from Dromos-Labs/metadex-public (V3/src, deployment-addresses/root-base.json and leaf-base.json) and
 * were checked against Base on 2026-10-27. The approach (registry for the gauge list, leaf voter for weights, fee releases
 * for the pace, water-filling for the split) follows github.com/Hryhorii77/aero-allocator (MIT); the code is our own.
 *
 * Used by the hourly Convex job (convex/aeroAllocator.ts) and the Allocate page, so nothing here touches the DOM.
 */
import { encodeFunctionData, getAddress, keccak256, parseAbi, parseAbiItem, toBytes, type Address, type PublicClient } from 'viem';

export const AERO_CHAIN_ID = 8453;

export const AERO = {
  /** FactoryRegistry: gauge factories, their gauges, each gauge's pool, rewards contract and emission cap. */
  registry: '0x7b2A2c12dC5Ea2a31455952a05031C3E4BB28F3E',
  /** Root voter on Base: `allocate` lives here. */
  voter: '0x49d7d4f17Ec56Ef8fA04E464AF5D1A4942CC31e6',
  /** Base leaf voter: gauge weights, a position's gauges, the cooldown. */
  leafVoter: '0x382409fad8503FbCdbB27A4211551fa03e884078',
  /** sAERO positions (NFTs). */
  escrow: '0xBF7977E1521e9a3032bf7243Ee4712f311f13915',
  /** AERO since the 2026-10-22 launch (root-base.json `token`); what sAERO is made of. */
  aero: '0x3f5bF3EdAc59d650D8fDf9657a71F2f904A3a4Ee',
  /** Aerodrome's AERO and veAERO from before the launch: they still sit in wallets until upgraded 1:1 on aero.xyz. */
  legacyAero: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
  legacyVe: '0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4',
} as const satisfies Record<string, Address>;

/**
 * Every chain Aero runs gauges on (Dromos-Labs/metadex-public deployment-addresses/leaf-<chain>.json, checked live
 * 2026-10-27). Base is the root: allocations and claims are sent there and reach the others as messages. The leaf voter
 * has the same address on every chain; each chain has its own FactoryRegistry. Arc is left out (no public RPC answered).
 */
export type AeroChain = { id: number; name: string; registry: Address; llama: string };
export const AERO_CHAINS: AeroChain[] = [
  { id: 8453, name: 'Base', registry: '0x7b2A2c12dC5Ea2a31455952a05031C3E4BB28F3E', llama: 'base' },
  { id: 4663, name: 'Robinhood', registry: '0xdd1705e23762F4D6e44D8C31BD8Ea80c54612239', llama: 'robinhood' },
  { id: 1, name: 'Ethereum', registry: '0xdd1705e23762F4D6e44D8C31BD8Ea80c54612239', llama: 'ethereum' },
  { id: 42161, name: 'Arbitrum', registry: '0x9E635b2c689fC52201DF7eF1C9FA607c2F58f666', llama: 'arbitrum' },
  { id: 10, name: 'OP', registry: '0xb6F9705A631CC1C0E8570FFde48882C95E2Df408', llama: 'optimism' },
  { id: 57073, name: 'Ink', registry: '0xdd1705e23762F4D6e44D8C31BD8Ea80c54612239', llama: 'ink' },
];
export const chainName = (id: number) => AERO_CHAINS.find((c) => c.id === id)?.name ?? `Chain ${id}`;
/** Base's message orchestrator: knows each chain's adapter, which quotes the ETH a message there costs. */
const ROOT_ORCHESTRATOR: Address = '0x4F347Fec2aEb8fdB569045AF4D0806eE7f7F6194';
/** The leaf orchestrator (same address on every leaf chain): the only caller a leaf voter takes a claim message from. */
const LEAF_ORCHESTRATOR: Address = '0x7EA1079604af6dA2282B80f4cDc6Cea7b07914fe';

/** The cooldown at launch, used until the live one is read. */
export const DEFAULT_COOLDOWN_SEC = 169_200;
/** BTB a user pays, from their in-app balance, to rebuild the gauge data now instead of waiting for the hourly run. */
export const REFRESH_BTB = 10_000;
/** Data younger than this is not rebuilt on request: paying would buy nothing new. */
export const REFRESH_MIN_AGE_MS = 5 * 60_000;
/** Most entries one position's gauge list may hold on a chain (idle power included). */
export const MAX_GAUGES = 20;
/** Gauges with less power than this are left out of the ranking: a few dollars over almost no weight reads as a huge yield
 * that disappears the moment any real amount joins. */
export const MIN_RANK_WEIGHT = 50_000;

const WEEK = 604_800;
const DAY = 86_400;

export const registryAbi = parseAbi([
  'function gaugeFactories() view returns (address[])',
  'function factoryToGauges(address) view returns (address[])',
  'function gaugeToTarget(address) view returns (address)',
  'function gaugeToRewards(address) view returns (address)',
  'function emissionCap(address) view returns (uint128)',
]);
export const leafVoterAbi = parseAbi([
  'function gaugeStates(address) view returns (uint128 ceiling, uint128 claimed, uint48 lastSettlement, bool isRegistered, bool isActivated, uint128 surplus, uint256 lastIndex, uint256 lastTimeIndex, (int128 bias, int128 slope, uint48 ts, uint128 permanentStakeBalance) point)',
  'function tokenStates(uint256) view returns (address operator, uint48 lastAllocated, bool canVoteForZeroCapGauges, uint128 chainAllocation)',
  'function allocatedGauges(uint256) view returns (address[])',
  'function allocations(uint256, address) view returns (uint128)',
  'function allocationCooldown() view returns (uint48)',
]);
export const voterAbi = parseAbi([
  'function allocationChainAmounts(uint256 tokenId, uint256 chainId) view returns (uint128)',
]);
export const escrowAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
  'function balanceOfNFT(uint256) view returns (uint256)',
  'function staked(uint256) view returns ((uint128 amount, uint48 end, bool isPermanent))',
]);
/** Incentive programs on a gauge's rewards contract: ids from 1, `rate` is raw token units per second times 1e18. */
export const incentiveAbi = parseAbi([
  'function incentiveCount() view returns (uint256)',
  'function incentive(uint256) view returns ((address token, uint256 amount, uint256 rate, uint48 start, uint48 end, address creator))',
]);
const poolAbi = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function tickSpacing() view returns (int24)',
  'function fee() view returns (uint24)',
  'function symbol() view returns (string)',
]);
const erc20Abi = parseAbi(['function symbol() view returns (string)', 'function decimals() view returns (uint8)']);

/** Emitted by a gauge's rewards contract each time trading fees are released to the gauge's allocators. */
export const notifyFeesEvent = parseAbiItem('event NotifyFeesAmount(address indexed _gauge, address indexed _token, uint256 _amount)');

export const allocateAbi = [
  {
    type: 'function', name: 'allocate', stateMutability: 'payable',
    inputs: [
      { name: '_tokenId', type: 'uint256' },
      { name: '_chainDispatches', type: 'tuple[]', components: [
        { name: 'chainId', type: 'uint256' }, { name: 'delta', type: 'uint128' }, { name: 'gasLimit', type: 'uint256' }, { name: 'value', type: 'uint256' },
      ] },
      { name: '_gaugeDispatches', type: 'tuple[]', components: [
        { name: 'chainId', type: 'uint256' }, { name: 'gasLimit', type: 'uint256' }, { name: 'value', type: 'uint256' },
        { name: 'gauges', type: 'tuple[]', components: [{ name: 'gauge', type: 'address' }, { name: 'allocated', type: 'uint128' }, { name: 'data', type: 'bytes' }] },
      ] },
      { name: '_refundRecipient', type: 'address' },
    ],
    outputs: [],
  },
  { type: 'error', name: 'CooldownActive', inputs: [] },
  { type: 'error', name: 'ChainAllocationMismatch', inputs: [{ name: '_chainId', type: 'uint256' }] },
  { type: 'error', name: 'GaugesNotStrictlyAscending', inputs: [] },
  { type: 'error', name: 'ZeroAllocation', inputs: [] },
  { type: 'error', name: 'InsufficientChain0Allocation', inputs: [] },
  { type: 'error', name: 'StakeExpired', inputs: [] },
  { type: 'error', name: 'StakeWithdrawn', inputs: [] },
  { type: 'error', name: 'StaleShape', inputs: [] },
  { type: 'error', name: 'NotAuthorized', inputs: [] },
] as const;

/** Why the voter refused, in plain words, from a failed simulation; null when it is none of its known errors. */
export function allocateErrorText(e: unknown): string | null {
  const text: Record<string, string> = {
    CooldownActive: 'This position was allocated too recently. Wait for its cooldown to end.',
    ChainAllocationMismatch: 'The position changed since the page loaded. Refresh and try again.',
    GaugesNotStrictlyAscending: 'The gauge list was out of order.',
    ZeroAllocation: 'A pool was given no power.',
    InsufficientChain0Allocation: 'Not enough of this position is idle.',
    StakeExpired: 'This lock has expired.',
    StakeWithdrawn: 'This position has been withdrawn.',
    StaleShape: 'The lock changed since the last allocation. Refresh and try again.',
    NotAuthorized: 'This wallet cannot allocate this position.',
  };
  let c = e as { data?: { errorName?: string }; cause?: unknown } | undefined;
  for (let i = 0; c && i < 8; i++) {
    const name = c.data?.errorName;
    if (name && text[name]) return text[name];
    c = c.cause as typeof c;
  }
  return null;
}

// ── Gauges ─────────────────────────────────────────────────────────────────

export type GaugeInfo = {
  chainId: number;
  gauge: Address;
  pool: Address;
  rewards: Address;
  token0: Address;
  token1: Address;
  symbol0: string;
  symbol1: string;
  /** "CL100" (concentrated, by tick spacing), "stable", "volatile", or "" when unknown. */
  kind: string;
  /** A concentrated pool's swap fee in percent; null for classic pools. */
  feePct: number | null;
  /** Power allocated to the gauge now, whole AERO. */
  weight: number;
  activated: boolean;
  /** AERO emission cap per week; 0 when none is set. */
  capPerWeek: number;
  /** Incentive programs streaming now. */
  incentives: { token: Address; perSec: number }[];
  /** Every incentive program on the gauge, ended ones too: a position can still have unclaimed rewards in them. */
  programs: { id: number; token: Address }[];
};

type Point = { bias: bigint; slope: bigint; ts: number; permanentStakeBalance: bigint };

/** A gauge's weight now: the decaying part (floored at 0) plus the permanent part, in whole AERO. */
export function weightNow(p: Point, nowSec: number): number {
  let decaying = p.bias - p.slope * BigInt(Math.max(0, nowSec - Number(p.ts)));
  if (decaying < 0n) decaying = 0n;
  return Number(decaying + p.permanentStakeBalance) / 1e18;
}

function poolKind(tickSpacing: number | null, symbol: string | null, feePips: number | null): { kind: string; feePct: number | null } {
  if (tickSpacing && tickSpacing > 0) return { kind: `CL${tickSpacing}`, feePct: feePips == null ? null : feePips / 10_000 };
  if (symbol?.startsWith('sAMM')) return { kind: 'stable', feePct: null };
  if (symbol?.startsWith('vAMM')) return { kind: 'volatile', feePct: null };
  return { kind: '', feePct: null };
}

const ok = <T,>(r: { status: string; result?: unknown }): T | null => (r.status === 'success' ? (r.result as T) : null);

/** Every Aero gauge on one chain with its pool, weight, cap and live incentives. About a dozen multicalls. */
export async function readGauges(client: PublicClient, nowSec = Math.floor(Date.now() / 1000), chain: AeroChain = AERO_CHAINS[0]): Promise<GaugeInfo[]> {
  const reg = chain.registry;
  const factories = await client.readContract({ address: reg, abi: registryAbi, functionName: 'gaugeFactories' });
  const lists = await Promise.all(factories.map((f) => client.readContract({ address: reg, abi: registryAbi, functionName: 'factoryToGauges', args: [f] })));
  const gauges = [...new Set(lists.flat())];

  const per = await client.multicall({
    allowFailure: true,
    contracts: gauges.flatMap((g) => [
      { address: reg, abi: registryAbi, functionName: 'gaugeToTarget', args: [g] },
      { address: reg, abi: registryAbi, functionName: 'gaugeToRewards', args: [g] },
      { address: reg, abi: registryAbi, functionName: 'emissionCap', args: [g] },
      { address: AERO.leafVoter, abi: leafVoterAbi, functionName: 'gaugeStates', args: [g] },
    ] as const),
  });
  const rows = gauges.map((gauge, i) => {
    const state = ok<readonly unknown[]>(per[i * 4 + 3]);
    return {
      gauge,
      pool: ok<Address>(per[i * 4]),
      rewards: ok<Address>(per[i * 4 + 1]),
      cap: ok<bigint>(per[i * 4 + 2]) ?? 0n,
      activated: state ? Boolean(state[4]) : false,
      point: state ? (state[8] as Point) : null,
    };
  }).filter((r): r is typeof r & { pool: Address; rewards: Address; point: Point } => !!r.pool && !!r.rewards && !!r.point);

  const poolReads = await client.multicall({
    allowFailure: true,
    contracts: rows.flatMap((r) => (['token0', 'token1', 'tickSpacing', 'fee', 'symbol'] as const).map((fn) => ({ address: r.pool, abi: poolAbi, functionName: fn }))),
  });
  const tokens = [...new Set(rows.flatMap((_, i) => [ok<Address>(poolReads[i * 5]), ok<Address>(poolReads[i * 5 + 1])]).filter((t): t is Address => !!t))];
  const syms = await client.multicall({ allowFailure: true, contracts: tokens.map((t) => ({ address: t, abi: erc20Abi, functionName: 'symbol' }) as const) });
  const symbolOf = new Map(tokens.map((t, i) => [t, ok<string>(syms[i]) ?? `${t.slice(0, 6)}`]));

  // Incentives: count per rewards contract, then each program (capped at 40 per gauge).
  const counts = await client.multicall({ allowFailure: true, contracts: rows.map((r) => ({ address: r.rewards, abi: incentiveAbi, functionName: 'incentiveCount' }) as const) });
  const progCalls = rows.flatMap((r, gi) => {
    const n = Number(ok<bigint>(counts[gi]) ?? 0n);
    return Array.from({ length: Math.min(n, 40) }, (_, k) => ({ gi, id: BigInt(k + 1), rewards: r.rewards }));
  });
  const progs = progCalls.length
    ? await client.multicall({ allowFailure: true, contracts: progCalls.map((p) => ({ address: p.rewards, abi: incentiveAbi, functionName: 'incentive', args: [p.id] }) as const) })
    : [];
  const incentives: GaugeInfo['incentives'][] = rows.map(() => []);
  const programs: GaugeInfo['programs'][] = rows.map(() => []);
  progs.forEach((res, i) => {
    const p = ok<{ token: Address; rate: bigint; start: number; end: number }>(res);
    if (!p) return;
    programs[progCalls[i].gi].push({ id: Number(progCalls[i].id), token: p.token });
    if (p.start > nowSec || p.end <= nowSec || p.rate === 0n) return;
    incentives[progCalls[i].gi].push({ token: p.token, perSec: Number(p.rate) / 1e18 });
  });

  return rows.flatMap((r, i): GaugeInfo[] => {
    const t0 = ok<Address>(poolReads[i * 5]);
    const t1 = ok<Address>(poolReads[i * 5 + 1]);
    if (!t0 || !t1) return [];
    const k = poolKind(ok<number>(poolReads[i * 5 + 2]), ok<string>(poolReads[i * 5 + 4]), ok<number>(poolReads[i * 5 + 3]));
    return [{
      chainId: chain.id, gauge: r.gauge, pool: r.pool, rewards: r.rewards, token0: t0, token1: t1,
      symbol0: symbolOf.get(t0) ?? '?', symbol1: symbolOf.get(t1) ?? '?',
      ...k,
      weight: weightNow(r.point, nowSec),
      activated: r.activated,
      capPerWeek: (Number(r.cap) / 1e18) * WEEK,
      incentives: incentives[i],
      programs: programs[i],
    }];
  });
}

// ── Fee pace ───────────────────────────────────────────────────────────────

/**
 * Per gauge, the USD released to allocators in each hour (unix hour index), kept for a few days. The first release a gauge
 * ever shows us is marked, because fees pile up in a pool before anyone allocates and that first release dumps them all at
 * once over an unknown stretch; counting it would make a new gauge look far better than it is.
 */
export type FeeLedger = {
  /** Last block read. */
  lastBlock: number;
  /** Gauge (lowercase) -> hour index -> USD released that hour. */
  hours: Record<string, Record<string, number>>;
  /** Gauge (lowercase) -> hour index of the first release seen, while that hour is still in the record. */
  first: Record<string, number>;
};

/** Hours of history the record keeps. */
export const LEDGER_HOURS = 60;
/** The pace is measured over at most this many recent hours. */
export const PACE_HOURS = 48;

export function pruneLedger(l: FeeLedger, nowHour: number): FeeLedger {
  const keepFrom = nowHour - LEDGER_HOURS;
  const hours: FeeLedger['hours'] = {};
  for (const [g, byHour] of Object.entries(l.hours)) {
    const kept = Object.fromEntries(Object.entries(byHour).filter(([h]) => Number(h) >= keepFrom));
    if (Object.keys(kept).length) hours[g] = kept;
  }
  const first = Object.fromEntries(Object.entries(l.first).filter(([, h]) => h >= keepFrom));
  return { lastBlock: l.lastBlock, hours, first };
}

/**
 * USD per day a gauge's fees run at: everything released after the hour of its first release in the window, over the time
 * since that hour, up to PACE_HOURS. Null when there is less than three hours to measure (unknown, not zero).
 */
export function feePace(byHour: Record<string, number> | undefined, firstHour: number | undefined, nowHour: number): { usdPerDay: number; hours: number } | null {
  if (!byHour) return null;
  const from = nowHour - PACE_HOURS;
  const seen = Object.keys(byHour).map(Number).filter((h) => h >= from).sort((a, b) => a - b);
  if (seen.length === 0) return null;
  // The window starts after the first release in it, whether or not it was the gauge's first ever: the release that opens
  // a window covers time before the window. A first-ever release later than that (a gauge new this week) moves it on.
  const start = Math.max(seen[0], firstHour != null && firstHour >= from ? firstHour : -Infinity);
  const after = seen.filter((h) => h > start);
  const hours = nowHour - start;
  if (after.length === 0 || hours < 3) return null;
  const usd = after.reduce((s, h) => s + byHour[h], 0);
  return { usdPerDay: (usd / (hours * 3600)) * DAY, hours };
}

// ── Ranking and split ──────────────────────────────────────────────────────

/** What a gauge pays all its allocators together, per day, and what is already in it. */
export type GaugeRate = { gauge: Address; ratePerDay: number; weight: number };

/** What `amount` of power earns per day in a gauge once it joins the weight already there. */
export const earnPerDay = (g: { ratePerDay: number; weight: number }, amount: number) =>
  amount > 0 ? (g.ratePerDay * amount) / (g.weight + amount) : 0;

/** APR in percent of earning `usdPerDay` on `amount` AERO at `aeroUsd`; null without a price. */
export function aprPct(usdPerDay: number, amount: number, aeroUsd: number | null | undefined): number | null {
  if (!aeroUsd || !(amount > 0)) return null;
  return ((usdPerDay * 365) / (amount * aeroUsd)) * 100;
}

export type SplitPart = { gauge: Address; pct: number; amount: number; usdPerDay: number };

/**
 * The split of `amount` across gauges that earns the most per day. Each extra unit of power in a gauge earns less than the
 * last (it dilutes everyone there, you included), so the best split gives every gauge used the same marginal return:
 * a = sqrt(rate * weight / lambda) - weight, with lambda found by bisection so the parts add up to `amount`. Parts under
 * 1% are dropped and the rest solved again, keeping at most `maxParts`. Percentages are in hundredths and add to exactly 100.
 */
export function bestSplit(gauges: GaugeRate[], amount: number, maxParts = 6): SplitPart[] {
  let set = gauges.filter((g) => g.ratePerDay > 0 && g.weight > 0)
    .sort((a, b) => b.ratePerDay / b.weight - a.ratePerDay / a.weight)
    .slice(0, 40);
  if (!(amount > 0) || set.length === 0) return [];

  const solve = (s: GaugeRate[]) => {
    let lo = 0;
    let hi = Math.max(...s.map((g) => g.ratePerDay / g.weight));
    const at = (lambda: number) => s.map((g) => Math.max(0, Math.sqrt((g.ratePerDay * g.weight) / lambda) - g.weight));
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid).reduce((a, b) => a + b, 0) > amount) lo = mid; else hi = mid;
    }
    const raw = at(hi);
    const sum = raw.reduce((a, b) => a + b, 0);
    return sum > 0 ? raw.map((a) => (a / sum) * amount) : raw;
  };

  let amounts = solve(set);
  for (let round = 0; round < 8; round++) {
    const keep = set.map((g, i) => ({ g, a: amounts[i] }))
      .filter((x) => x.a / amount >= 0.01)
      .sort((x, y) => y.a - x.a)
      .slice(0, maxParts)
      .map((x) => x.g);
    if (keep.length === 0) return [];
    if (keep.length === set.length) break;
    set = keep;
    amounts = solve(set);
  }

  const hundredths = amounts.map((a) => Math.floor((a / amount) * 10_000));
  hundredths[amounts.indexOf(Math.max(...amounts))] += 10_000 - hundredths.reduce((a, b) => a + b, 0);
  return set
    .map((g, i) => {
      const a = (hundredths[i] / 10_000) * amount;
      return { gauge: g.gauge, pct: hundredths[i] / 100, amount: a, usdPerDay: earnPerDay(g, a) };
    })
    .filter((p) => p.pct > 0)
    .sort((a, b) => b.pct - a.pct);
}

// ── Positions ──────────────────────────────────────────────────────────────

export type SaeroPosition = {
  tokenId: bigint;
  /** AERO staked, whole tokens. */
  staked: number;
  /** Voting power now, whole tokens. */
  power: number;
  isPermanent: boolean;
  /** Lock end, unix seconds; 0 when permanent. */
  endSec: number;
  /** Power idle (not on any chain), base units. */
  idleRaw: bigint;
  /** Power booked on Base, base units. */
  onBaseRaw: bigint;
  /** Last gauge allocation on Base, unix seconds; 0 if never. */
  lastAllocatedSec: number;
  /** Set when another address (an Autopilot, a manager) may allocate this position. */
  operator: Address | null;
  /** Where the position's power sits now, on every chain. */
  current: { chainId: number; gauge: Address; amountRaw: bigint }[];
  /** Power booked on each chain other than Base, base units. */
  elsewhere: { chainId: number; amountRaw: bigint }[];
};

/**
 * Every sAERO position `owner` holds (they live on Base), with what each has where: idle, on Base, and on any other Aero
 * chain, down to the gauges. `clientFor` gives a client for another chain; without one, that chain's gauges are skipped.
 */
export async function readPositions(client: PublicClient, owner: Address, clientFor?: (chainId: number) => PublicClient | null): Promise<SaeroPosition[]> {
  const n = Number(await client.readContract({ address: AERO.escrow, abi: escrowAbi, functionName: 'balanceOf', args: [owner] }));
  if (n === 0) return [];
  const ids = await client.multicall({
    allowFailure: false,
    contracts: Array.from({ length: Math.min(n, 20) }, (_, i) => ({ address: AERO.escrow, abi: escrowAbi, functionName: 'tokenOfOwnerByIndex', args: [owner, BigInt(i)] }) as const),
  }) as bigint[];
  const reads = await client.multicall({
    allowFailure: true,
    contracts: ids.flatMap((id) => [
      { address: AERO.escrow, abi: escrowAbi, functionName: 'staked', args: [id] },
      { address: AERO.escrow, abi: escrowAbi, functionName: 'balanceOfNFT', args: [id] },
      { address: AERO.voter, abi: voterAbi, functionName: 'allocationChainAmounts', args: [id, 0n] },
      { address: AERO.voter, abi: voterAbi, functionName: 'allocationChainAmounts', args: [id, BigInt(AERO_CHAIN_ID)] },
      { address: AERO.leafVoter, abi: leafVoterAbi, functionName: 'tokenStates', args: [id] },
      { address: AERO.leafVoter, abi: leafVoterAbi, functionName: 'allocatedGauges', args: [id] },
    ] as const),
  });
  const out: SaeroPosition[] = ids.map((tokenId, i) => {
    const st = ok<{ amount: bigint; end: number; isPermanent: boolean }>(reads[i * 6]);
    const leaf = ok<readonly [Address, number, boolean, bigint]>(reads[i * 6 + 4]);
    const op = leaf?.[0];
    return {
      tokenId,
      staked: st ? Number(st.amount) / 1e18 : 0,
      power: Number(ok<bigint>(reads[i * 6 + 1]) ?? 0n) / 1e18,
      isPermanent: !!st?.isPermanent,
      endSec: st && !st.isPermanent ? Number(st.end) : 0,
      idleRaw: ok<bigint>(reads[i * 6 + 2]) ?? 0n,
      onBaseRaw: ok<bigint>(reads[i * 6 + 3]) ?? 0n,
      lastAllocatedSec: leaf ? Number(leaf[1]) : 0,
      operator: op && !/^0x0+$/.test(op) ? op : null,
      current: (ok<Address[]>(reads[i * 6 + 5]) ?? []).map((gauge) => ({ chainId: AERO_CHAIN_ID, gauge, amountRaw: 0n })),
      elsewhere: [],
    };
  });
  // Power on the other chains: the root voter books it per chain; the gauges are read on that chain's leaf voter.
  const others = AERO_CHAINS.filter((c) => c.id !== AERO_CHAIN_ID);
  const booked = await client.multicall({
    allowFailure: true,
    contracts: out.flatMap((p) => others.map((c) => ({ address: AERO.voter, abi: voterAbi, functionName: 'allocationChainAmounts', args: [p.tokenId, BigInt(c.id)] }) as const)),
  });
  out.forEach((p, pi) => others.forEach((c, ci) => {
    const n = ok<bigint>(booked[pi * others.length + ci]) ?? 0n;
    if (n > 0n) p.elsewhere.push({ chainId: c.id, amountRaw: n });
  }));
  if (clientFor) {
    await Promise.all(others.map(async (c) => {
      const holders = out.filter((p) => p.elsewhere.some((e) => e.chainId === c.id));
      const leaf = holders.length ? clientFor(c.id) : null;
      if (!leaf) return;
      const lists = await leaf.multicall({
        allowFailure: true,
        contracts: holders.map((p) => ({ address: AERO.leafVoter, abi: leafVoterAbi, functionName: 'allocatedGauges', args: [p.tokenId] }) as const),
      });
      const pairs = holders.flatMap((p, i) => (ok<Address[]>(lists[i]) ?? []).map((gauge) => ({ p, gauge })));
      if (!pairs.length) return;
      const amts = await leaf.multicall({
        allowFailure: true,
        contracts: pairs.map(({ p, gauge }) => ({ address: AERO.leafVoter, abi: leafVoterAbi, functionName: 'allocations', args: [p.tokenId, gauge] }) as const),
      });
      pairs.forEach(({ p, gauge }, i) => p.current.push({ chainId: c.id, gauge, amountRaw: ok<bigint>(amts[i]) ?? 0n }));
    }).map((x) => x.catch(() => {})));
  }
  const amountCalls = out.flatMap((p) => p.current.filter((c) => c.chainId === AERO_CHAIN_ID).map((c) => ({ p, c })));
  if (amountCalls.length) {
    const amts = await client.multicall({
      allowFailure: true,
      contracts: amountCalls.map(({ p, c }) => ({ address: AERO.leafVoter, abi: leafVoterAbi, functionName: 'allocations', args: [p.tokenId, c.gauge] }) as const),
    });
    amountCalls.forEach(({ c }, i) => { c.amountRaw = ok<bigint>(amts[i]) ?? 0n; });
  }
  return out;
}

/** What a position earns per day where it sits now, and the best split for it, from the snapshot's gauges. */
export type PlanGauge = { chainId: number; gauge: Address; weight: number; activated: boolean; feesPerDay: number | null; incentivesPerDay: number };
const gkey = (chainId: number, gauge: string) => `${chainId}:${gauge.toLowerCase()}`;

export const ratePerDayOf = (g: Pick<PlanGauge, 'feesPerDay' | 'incentivesPerDay'>) => (g.feesPerDay ?? 0) + g.incentivesPerDay;

/**
 * Every rankable gauge with what `amount` earns there, best first, and the best split. A position already in a gauge is
 * part of its weight, so its own amount is taken out first; otherwise it would look like it dilutes itself.
 */
export function planFor<G extends PlanGauge>(gauges: G[], position: Pick<SaeroPosition, 'current'> | null, amount: number, splitChains: number[] = [AERO_CHAIN_ID]) {
  const own = new Map<string, number>();
  for (const c of position?.current ?? []) own.set(gkey(c.chainId, c.gauge), Number(c.amountRaw) / 1e18);
  const ranked = gauges
    .filter((g) => g.activated && g.feesPerDay != null && ratePerDayOf(g) > 0)
    .map((g) => {
      const weight = Math.max(0, g.weight - (own.get(gkey(g.chainId, g.gauge)) ?? 0));
      return { g, weight, earn: earnPerDay({ ratePerDay: ratePerDayOf(g), weight }, amount) };
    })
    .filter((r) => r.weight >= MIN_RANK_WEIGHT)
    .sort((a, b) => b.earn - a.earn);
  // The split only uses chains an allocation can reach from here (Base for now); the ranking shows every chain.
  const split = bestSplit(ranked.filter((r) => splitChains.includes(r.g.chainId)).map((r) => ({ gauge: r.g.gauge, ratePerDay: ratePerDayOf(r.g), weight: r.weight })), amount);
  const byGauge = new Map(gauges.map((g) => [gkey(g.chainId, g.gauge), g]));
  // What the position earns now: in total, and on the chains the split can move (the fair thing to compare it with).
  let current: number | null = null;
  let currentMovable: number | null = null;
  if (position) {
    current = 0; currentMovable = 0;
    for (const c of position.current) {
      const g = byGauge.get(gkey(c.chainId, c.gauge));
      const mine = Number(c.amountRaw) / 1e18;
      if (!g || mine <= 0) continue;
      const usd = earnPerDay({ ratePerDay: ratePerDayOf(g), weight: Math.max(0, g.weight - mine) }, mine);
      current += usd;
      if (splitChains.includes(c.chainId)) currentMovable += usd;
    }
  }
  return { ranked, split, splitUsd: split.reduce((s, p) => s + p.usdPerDay, 0), current, currentMovable };
}

/** A move worth suggesting: at least this much more a day, and this share more than now, since each move restarts the wait. */
export const NUDGE_MIN_USD = 0.5;
export const NUDGE_MIN_SHARE = 0.05;
export const worthMoving = (current: number | null, best: number) =>
  current != null && best - current >= NUDGE_MIN_USD && best >= current * (1 + NUDGE_MIN_SHARE);

/** Seconds until a position can be allocated again; 0 when it can now. */
export function cooldownLeft(lastAllocatedSec: number, cooldownSec: number, nowSec: number): number {
  return lastAllocatedSec > 0 ? Math.max(0, lastAllocatedSec + cooldownSec - nowSec) : 0;
}

// ── Rewards ────────────────────────────────────────────────────────────────

const rewardsAbi = parseAbi([
  'function earnedFees(uint256 tokenId, uint256 maxCheckpoints) view returns (uint256, uint256)',
  'function earnedIncentives(uint256 tokenId, uint256 programId, uint256 maxCheckpoints) view returns (uint256)',
]);
/** Checkpoints one read or claim walks; a position that changed pools very often may need a second claim. */
const MAX_CHECKPOINTS = 100n;

export const claimRewardsAbi = [{
  type: 'function', name: 'claimRewards', stateMutability: 'payable',
  inputs: [
    { name: '_tokenId', type: 'uint256' },
    { name: '_claimRewardsParams', type: 'tuple[]', components: [
      { name: 'chainId', type: 'uint256' }, { name: 'gasLimit', type: 'uint256' }, { name: 'value', type: 'uint256' }, { name: 'recipient', type: 'address' },
      { name: 'feeClaims', type: 'tuple[]', components: [{ name: 'votingRewardsManager', type: 'address' }, { name: 'maxCheckpoints', type: 'uint256' }] },
      { name: 'incentiveClaims', type: 'tuple[]', components: [{ name: 'votingRewardsManager', type: 'address' }, { name: 'programId', type: 'uint256' }, { name: 'maxCheckpoints', type: 'uint256' }] },
    ] },
    { name: '_refundRecipient', type: 'address' },
  ],
  outputs: [],
}] as const;

export type RewardGauge = { rewards: Address; token0: Address; token1: Address; programs: { id: number; token: Address }[] };
export type Earned = {
  chainId: number;
  /** Rewards contracts with fees to claim. */
  feeFrom: Address[];
  /** Incentive programs with something to claim. */
  incentiveFrom: { rewards: Address; id: number }[];
  /** Total per token (lowercase address), raw units. */
  byToken: Map<string, bigint>;
};

/**
 * What a position has earned and not claimed, across every gauge (also ones it has since left), in two multicalls.
 */
export async function readEarned(client: PublicClient, tokenId: bigint, gauges: RewardGauge[], chainId = AERO_CHAIN_ID): Promise<Earned> {
  const fees = await client.multicall({
    allowFailure: true,
    contracts: gauges.map((g) => ({ address: g.rewards, abi: rewardsAbi, functionName: 'earnedFees', args: [tokenId, MAX_CHECKPOINTS] }) as const),
  });
  const progs = gauges.flatMap((g) => g.programs.map((p) => ({ g, p })));
  const inc = progs.length ? await client.multicall({
    allowFailure: true,
    contracts: progs.map(({ g, p }) => ({ address: g.rewards, abi: rewardsAbi, functionName: 'earnedIncentives', args: [tokenId, BigInt(p.id), MAX_CHECKPOINTS] }) as const),
  }) : [];
  const out: Earned = { chainId, feeFrom: [], incentiveFrom: [], byToken: new Map() };
  const add = (t: Address, n: bigint) => out.byToken.set(t.toLowerCase(), (out.byToken.get(t.toLowerCase()) ?? 0n) + n);
  gauges.forEach((g, i) => {
    const r = ok<readonly [bigint, bigint]>(fees[i]);
    if (!r || (r[0] === 0n && r[1] === 0n)) return;
    out.feeFrom.push(g.rewards);
    if (r[0] > 0n) add(g.token0, r[0]);
    if (r[1] > 0n) add(g.token1, r[1]);
  });
  progs.forEach(({ g, p }, i) => {
    const n = ok<bigint>(inc[i]);
    if (!n) return;
    out.incentiveFrom.push({ rewards: g.rewards, id: p.id });
    add(p.token, n);
  });
  return out;
}

const hasClaims = (e: Earned) => e.feeFrom.length > 0 || e.incentiveFrom.length > 0;
const feeClaimsOf = (e: Earned) => e.feeFrom.map((r) => ({ votingRewardsManager: r, maxCheckpoints: MAX_CHECKPOINTS }));
const incentiveClaimsOf = (e: Earned) => e.incentiveFrom.map((x) => ({ votingRewardsManager: x.rewards, programId: BigInt(x.id), maxCheckpoints: MAX_CHECKPOINTS }));

/** What one chain's part of a claim needs: the gas its message may use there and the ETH that message costs. 0 on Base. */
export type ClaimCost = { chainId: number; gasLimit: bigint; value: bigint };

const leafClaimAbi = parseAbi([
  'function claimRewards(uint256 tokenId, address recipient, (address votingRewardsManager, uint256 maxCheckpoints)[] feeClaims, (address votingRewardsManager, uint256 programId, uint256 maxCheckpoints)[] incentiveClaims)',
]);
const orchestratorAbi = parseAbi(['function adapters(uint256 chainId) view returns (address)']);
const adapterAbi = parseAbi(['function quoteMessage(bytes message, uint256 gasLimit, address refundRecipient) view returns (uint256)']);

/**
 * The cost of claiming `earned` on another chain: the claim's gas there, measured by running it as the leaf orchestrator
 * would, with room for the message handling around it; then the ETH Base's adapter for that chain charges to carry a
 * message with that much gas. Too little gas would strand the claim, so this errs high (a little more ETH, nothing lost).
 */
export async function claimCost(base: PublicClient, leaf: PublicClient, tokenId: bigint, earned: Earned, recipient: Address): Promise<ClaimCost> {
  if (earned.chainId === AERO_CHAIN_ID) return { chainId: AERO_CHAIN_ID, gasLimit: 0n, value: 0n };
  const used = await leaf.estimateGas({
    account: LEAF_ORCHESTRATOR,
    to: AERO.leafVoter,
    data: encodeFunctionData({ abi: leafClaimAbi, functionName: 'claimRewards', args: [tokenId, recipient, feeClaimsOf(earned), incentiveClaimsOf(earned)] }),
  });
  const gasLimit = (used * 3n) / 2n + 200_000n;
  const adapter = await base.readContract({ address: ROOT_ORCHESTRATOR, abi: orchestratorAbi, functionName: 'adapters', args: [BigInt(earned.chainId)] });
  // The fee is priced on destination gas, not message bytes, so a placeholder of a claim's size quotes it.
  const value = await base.readContract({ address: adapter, abi: adapterAbi, functionName: 'quoteMessage', args: [`0x${'00'.repeat(480)}`, gasLimit, recipient] });
  return { chainId: earned.chainId, gasLimit, value };
}

/**
 * Claims everything in `earned` (one entry per chain) to `recipient`, in one transaction on Base. Base's part is paid out
 * in the same transaction; each other chain's part goes as a message and pays out there a few minutes later, with its
 * cost (from claimCost) sent along as ETH.
 */
export function claimCall(tokenId: bigint, earned: Earned[], recipient: Address, costs: ClaimCost[] = []) {
  const parts = earned.filter(hasClaims).sort((a, b) => a.chainId - b.chainId);
  const costOf = (id: number) => costs.find((c) => c.chainId === id) ?? { gasLimit: 0n, value: 0n };
  const params = parts.map((e) => ({
    chainId: BigInt(e.chainId), gasLimit: costOf(e.chainId).gasLimit, value: costOf(e.chainId).value, recipient,
    feeClaims: feeClaimsOf(e), incentiveClaims: incentiveClaimsOf(e),
  }));
  const value = params.reduce((s, p) => s + p.value, 0n);
  const args = [tokenId, params, recipient] as const;
  return { to: AERO.voter as Address, data: encodeFunctionData({ abi: claimRewardsAbi, functionName: 'claimRewards', args }), value, args };
}

// ── Allocate ───────────────────────────────────────────────────────────────

const ZERO: Address = '0x0000000000000000000000000000000000000000';
/** The voter's return-to-idle marker: the low 20 bytes of keccak256("DROMOS_DEALLOC_GAUGE"). */
export const DEALLOC_GAUGE: Address = getAddress(`0x${keccak256(toBytes('DROMOS_DEALLOC_GAUGE')).slice(-40)}`);

/**
 * The `allocate` call that puts a position's whole Base budget (idle power plus what is on Base already) on `picks`, by
 * percentage. The gauge list replaces the old one outright, so it must add up exactly to the budget, go strictly up by
 * address and hold no zero amounts; any share short of 100% stays on Base as idle (the zero-address entry, first).
 */
export function allocateCall(p: Pick<SaeroPosition, 'tokenId' | 'idleRaw' | 'onBaseRaw'>, picks: { gauge: Address; pct: number }[], refund: Address) {
  const total = p.idleRaw + p.onBaseRaw;
  if (total <= 0n) throw new Error('This position has no power to allocate.');
  if (picks.length === 0) throw new Error('Pick at least one pool.');
  const parts = picks.map((x) => ({ gauge: getAddress(x.gauge), bps: BigInt(Math.round(x.pct * 100)) })).filter((x) => x.bps > 0n);
  const bps = parts.reduce((s, x) => s + x.bps, 0n);
  if (bps > 10_000n) throw new Error('Shares add up to more than 100%.');
  const amounts = parts.map((x) => ({ gauge: x.gauge, bps: x.bps, allocated: (total * x.bps) / 10_000n }));
  const wanted = (total * bps) / 10_000n;
  const largest = amounts.reduce((m, x) => (x.bps > m.bps ? x : m), amounts[0]);
  largest.allocated += wanted - amounts.reduce((s, x) => s + x.allocated, 0n);
  const idle = total - wanted;
  const sorted = amounts.map(({ gauge, allocated }) => ({ gauge, allocated })).sort((a, b) => (BigInt(a.gauge) < BigInt(b.gauge) ? -1 : 1));
  const gauges = idle > 0n ? [{ gauge: ZERO, allocated: idle }, ...sorted] : sorted;
  if (gauges.length > MAX_GAUGES) throw new Error(`At most ${MAX_GAUGES} pools per position.`);
  if (gauges.some((g) => g.allocated === 0n)) throw new Error('A share is too small to hold any power.');
  return dispatch(p.tokenId, p.idleRaw, gauges, refund);
}

/** Takes everything the position has on Base back to idle. */
export function returnAllCall(p: Pick<SaeroPosition, 'tokenId' | 'onBaseRaw'>, refund: Address) {
  if (p.onBaseRaw <= 0n) throw new Error('Nothing of this position is on Base.');
  return dispatch(p.tokenId, 0n, [{ gauge: DEALLOC_GAUGE, allocated: p.onBaseRaw }], refund);
}

function dispatch(tokenId: bigint, delta: bigint, gauges: { gauge: Address; allocated: bigint }[], refund: Address) {
  const chainId = BigInt(AERO_CHAIN_ID);
  // Base is the root chain: no message fee, so no gas limit or value.
  const args = [
    tokenId,
    delta > 0n ? [{ chainId, delta, gasLimit: 0n, value: 0n }] : [],
    [{ chainId, gasLimit: 0n, value: 0n, gauges: gauges.map((g) => ({ ...g, data: '0x' as const })) }],
    refund,
  ] as const;
  return { to: AERO.voter as Address, data: encodeFunctionData({ abi: allocateAbi, functionName: 'allocate', args }), value: 0n, args };
}
