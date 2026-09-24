import { action, internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  BaseError, ContractFunctionRevertedError, createWalletClient, defineChain, encodeAbiParameters, fallback, http, isAddress, parseAbi,
  parseEventLogs, type Chain, type PublicClient,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { getChainClient } from "../src/lib/chainClient";
import { chainTransport } from "../src/lib/chainRpc";
import { fetchV3Positions } from "../src/protocols/dexs/uniswap";
import { AERODROME_CL_DEPLOYMENTS } from "../src/protocols/dexs/aerodrome";
import { GIGA_V3_DEPLOYMENT, UP_V3_DEPLOYMENT } from "../src/protocols/dexs/robinhood";
import { uniswapV3DeploymentForChain, type V3Deployment } from "../src/protocols/dexs/uniswap/v3/addresses";
import type { LiquidityPosition } from "../src/protocols/types";
import {
  ADAPTER_ERRORS_ABI, AUTO_STABLES, AUTO_WETH, Action, KYBER_CHAIN, KYBER_ROUTER, REWARD_COMPOUND_CHAINS, REWARD_TOKEN, CHECK_INTERVALS, COMPOUND_COOLDOWN_MS, FACTORY_ABI, REBALANCE_AGENT,
  V6, V6_REGISTRY, WALLET_ABI, adapterFor, collectParams, compoundBtb, compoundMinUsd, compoundParams, gaugeParams,
  hasPriceHistory, isFarmManager, lpConfig, packPosition, rebalanceBtb, rebalanceParams, stakeAdapterFor,
} from "./autoRebalanceConfig";

/** Reads or sends that fail this many times in a row pause the row. */
const MAX_FAILURES = 6;
/** A failed read is retried after this long, not a full interval. */
const RETRY_MS = 5 * 60_000;

const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com/"] } },
});

/** Transactions go through endpoints that accept them; public read-only proxies refuse sends. */
const SEND_TRANSPORT: Record<number, ReturnType<typeof fallback>> = {
  8453: chainTransport(8453) as ReturnType<typeof fallback>,
  4663: fallback([http("https://rpc.mainnet.chain.robinhood.com/"), http("https://robinhood.api.pocket.network")]),
};
const CHAINS: Record<number, Chain> = { 8453: base, 4663: robinhood };

const GAUGE_ABI = parseAbi([
  "function stakedContains(address depositor, uint256 tokenId) view returns (bool)",
]);
const FARM_ABI = parseAbi([
  "function userPositionInfos(uint256 tokenId) view returns (uint128 liquidity, int24 tickLower, int24 tickUpper, uint256 rewardGrowthInside, uint256 reward, address user, uint256 pid, uint40 lastLiquidityChange)",
]);

/** Whether the wallet has this position staked in `stake`: an Aerodrome-style gauge, or Giga's farm. */
async function stakedIn(client: PublicClient, chainId: number, pm: string, stake: string, holder: string, wallet: string, tokenId: bigint) {
  if (holder.toLowerCase() !== stake.toLowerCase()) return false;
  if (isFarmManager(chainId, pm)) {
    const info = await client.readContract({ address: stake as `0x${string}`, abi: FARM_ABI, functionName: "userPositionInfos", args: [tokenId] });
    return info[5].toLowerCase() === wallet.toLowerCase();
  }
  return client.readContract({ address: stake as `0x${string}`, abi: GAUGE_ABI, functionName: "stakedContains", args: [wallet as `0x${string}`, tokenId] });
}
const NFT_ABI = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);
const RUN_ABI = [...WALLET_ABI, ...ADAPTER_ERRORS_ABI];

/** The DEX deployment behind a position manager this feature supports. */
function deploymentFor(chainId: number, positionManager: string): V3Deployment | null {
  const pm = positionManager.toLowerCase();
  if (chainId === 8453) {
    const aero = AERODROME_CL_DEPLOYMENTS.find((d) => d.positionManager.toLowerCase() === pm);
    if (aero) return aero;
  }
  if (chainId === 4663 && UP_V3_DEPLOYMENT.positionManager.toLowerCase() === pm) return UP_V3_DEPLOYMENT;
  if (chainId === 4663 && GIGA_V3_DEPLOYMENT.positionManager.toLowerCase() === pm) return GIGA_V3_DEPLOYMENT;
  const uni = uniswapV3DeploymentForChain(chainId);
  return uni && uni.positionManager.toLowerCase() === pm ? uni : null;
}

function agentAccount() {
  const key = process.env.REBALANCE_AGENT_KEY;
  if (!key) throw new Error("REBALANCE_AGENT_KEY is not set");
  const account = privateKeyToAccount(key as `0x${string}`);
  if (account.address.toLowerCase() !== REBALANCE_AGENT.toLowerCase()) throw new Error("Agent key does not match REBALANCE_AGENT");
  return account;
}

/** Name of the custom error a reverted simulation carried, if any. */
function revertName(e: unknown): string | null {
  if (!(e instanceof BaseError)) return null;
  const r = e.walk((err) => err instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
  return r?.data?.errorName ?? null;
}

/** Reverts that only mean "not now": the check waits for the next tick instead of counting a failure. */
const WAIT_REASONS: Record<string, string> = {
  PositionInRange: "Out of range, waiting for the price to settle outside the range.",
  PriceUnstable: "Out of range, waiting while the price moves fast.",
  CooldownActive: "Out of range, waiting for the cooldown since the last rebalance.",
  StakeTooRecent: "Out of range, waiting for the minimum stake time before it can be unstaked.",
  OracleUnavailable: "Out of range, waiting for enough price history.",
};

type Sent = { ok: true; logs: import("viem").Log[] } | { ok: false; name: string | null; message: string };

/**
 * The agent's part of a rebalance, through the owner's wallet: unstake if the
 * position is staked, rebalance, and restake the new position when the owner
 * keeps it staked. Every transaction is simulated first, so a refusal costs no
 * gas. If the rebalance has to wait after an unstake, the old position is put
 * straight back in its gauge.
 */
/** Simulate, then send, one `run` through the owner's wallet as the agent. */
function sender(client: PublicClient, chainId: number, wallet: `0x${string}`) {
  const account = agentAccount();
  const walletClient = createWalletClient({ account, chain: CHAINS[chainId], transport: SEND_TRANSPORT[chainId] });
  const o = { wallet };
  return async (adapter: `0x${string}`, params: `0x${string}`): Promise<Sent> => {
    let request;
    try {
      ({ request } = await client.simulateContract({ account, address: o.wallet, abi: RUN_ABI, functionName: "run", args: [adapter, params] }));
    } catch (e) {
      return { ok: false, name: revertName(e), message: e instanceof Error ? e.message.slice(0, 160) : "simulation failed" };
    }
    // The estimate is exact for the simulated block; a rebalance that lands a
    // block later can need a little more, and an out-of-gas revert still costs
    // the gas. A margin is far cheaper than a failed transaction.
    const estimate = await client.estimateContractGas({ account, address: o.wallet, abi: RUN_ABI, functionName: "run", args: [adapter, params] });
    const hash = await walletClient.writeContract({ ...request, gas: (estimate * 13n) / 10n });
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
    if (receipt.status !== "success") return { ok: false, name: null, message: `transaction ${hash} reverted` };
    return { ok: true, logs: receipt.logs };
  };
}

async function execute(
  client: PublicClient,
  o: { chainId: number; wallet: `0x${string}`; pm: `0x${string}`; adapter: `0x${string}`; tokenId: bigint; gauge?: `0x${string}`; stakedNow: boolean },
) {
  const send = sender(client, o.chainId, o.wallet);
  const stakeAdapter = stakeAdapterFor(o.chainId, o.pm);
  const stop = (r: Extract<Sent, { ok: false }>) => ({
    newTokenId: null, staked: false,
    wait: r.name && WAIT_REASONS[r.name] ? WAIT_REASONS[r.name] : null,
    error: r.name ?? r.message,
  });

  let unstaked = false;
  if (o.stakedNow && o.gauge) {
    const r = await send(stakeAdapter, gaugeParams(Action.Unstake, o.gauge, o.tokenId));
    if (!r.ok) return stop(r);
    unstaked = true;
  }
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
  const r = await send(o.adapter, rebalanceParams(o.pm, o.tokenId, deadline));
  if (!r.ok) {
    if (unstaked && o.gauge) await send(stakeAdapter, gaugeParams(Action.Stake, o.gauge, o.tokenId)).catch(() => null);
    return stop(r);
  }
  const minted = parseEventLogs({ abi: NFT_ABI, eventName: "Transfer", logs: r.logs }).find((l) =>
    l.address.toLowerCase() === o.pm.toLowerCase() && /^0x0{40}$/.test(l.args.from) && l.args.to.toLowerCase() === o.wallet.toLowerCase());
  if (!minted) return { newTokenId: null, staked: false, wait: null, error: "rebalance landed but no new position was found" };
  const newTokenId = minted.args.tokenId;
  // A refused restake leaves the new position safe in the wallet, unstaked.
  const staked = o.gauge ? (await send(stakeAdapter, gaugeParams(Action.Stake, o.gauge, newTokenId)).catch(() => null))?.ok === true : false;
  return { newTokenId, staked, wait: null, error: null };
}

const ERC20_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const REGISTRY_ABI = parseAbi(["function isListedPool(address) view returns (bool)"]);
const SLIP_FACTORY_ABI = parseAbi(["function getPool(address,address,int24) view returns (address)"]);
const UNI_FACTORY_ABI = parseAbi(["function getPool(address,address,uint24) view returns (address)"]);

let ethUsdCache: { at: number; usd: number } | null = null;
/** ETH in USD from DefiLlama, cached for 10 minutes. */
async function ethUsd(): Promise<number | null> {
  if (ethUsdCache && Date.now() - ethUsdCache.at < 10 * 60_000) return ethUsdCache.usd;
  try {
    const res = await fetch("https://coins.llama.fi/prices/current/coingecko:ethereum");
    const usd = (await res.json())?.coins?.["coingecko:ethereum"]?.price;
    if (typeof usd === "number" && usd > 0) { ethUsdCache = { at: Date.now(), usd }; return usd; }
  } catch { /* unpriced */ }
  return null;
}

/**
 * The USD value of a position's uncollected fees, from the pool's own price
 * and one side priced as a stablecoin or as ETH. Null when neither side can be
 * priced, in which case nothing is compounded.
 */
async function feesUsd(chainId: number, p: LiquidityPosition): Promise<number | null> {
  const known = async (token: string): Promise<number | null> => {
    const t = token.toLowerCase();
    if ((AUTO_STABLES[chainId] ?? []).includes(t)) return 1;
    if (AUTO_WETH[chainId] === t) return ethUsd();
    return null;
  };
  // Price of one whole token0 in token1.
  const price01 = Math.pow(1.0001, p.currentTick) * Math.pow(10, p.decimals0 - p.decimals1);
  let usd0 = await known(p.token0);
  let usd1 = await known(p.token1);
  if (usd0 == null && usd1 != null) usd0 = usd1 * price01;
  if (usd1 == null && usd0 != null && price01 > 0) usd1 = usd0 / price01;
  if (usd0 == null || usd1 == null) return null;
  return Number(p.fees0) / 10 ** p.decimals0 * usd0 + Number(p.fees1) / 10 ** p.decimals1 * usd1;
}

/**
 * Put a position's fees back into it through the owner's wallet. On a pool the
 * admin listed the agent collects first and then adds exactly what came out;
 * anywhere else the adapter itself limits the agent to the fees it collects.
 */
async function compoundFees(client: PublicClient, d: V3Deployment, o: { chainId: number; wallet: `0x${string}`; pm: `0x${string}`; adapter: `0x${string}`; tokenId: bigint; p: LiquidityPosition }) {
  const send = sender(client, o.chainId, o.wallet);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
  const pool = d.slipstream
    ? await client.readContract({ address: d.factory, abi: SLIP_FACTORY_ABI, functionName: "getPool", args: [o.p.token0, o.p.token1, o.p.tickSpacing ?? o.p.fee] })
    : await client.readContract({ address: d.factory, abi: UNI_FACTORY_ABI, functionName: "getPool", args: [o.p.token0, o.p.token1, o.p.fee] });
  const listed = await client.readContract({ address: V6_REGISTRY as `0x${string}`, abi: REGISTRY_ABI, functionName: "isListedPool", args: [pool] });
  if (!listed) return send(o.adapter, compoundParams(o.pm, o.tokenId, 0n, 0n, deadline));
  const bal = () => Promise.all([o.p.token0, o.p.token1].map((t) => client.readContract({ address: t, abi: ERC20_ABI, functionName: "balanceOf", args: [o.wallet] })));
  const before = await bal();
  const collected = await send(o.adapter, collectParams(o.pm, o.tokenId));
  if (!collected.ok) return collected;
  const after = await bal();
  return send(o.adapter, compoundParams(o.pm, o.tokenId, after[0] - before[0], after[1] - before[1], deadline));
}

const GAUGE_EARNED_ABI = parseAbi(["function earned(address account, uint256 tokenId) view returns (uint256)"]);

/** USD price from DefiLlama, cached for 10 minutes per key. */
const llamaCache = new Map<string, { at: number; usd: number }>();
async function llamaUsd(key: string): Promise<number | null> {
  const hit = llamaCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.usd;
  try {
    const usd = (await (await fetch(`https://coins.llama.fi/prices/current/${key}`)).json())?.coins?.[key]?.price;
    if (typeof usd === "number" && usd > 0) { llamaCache.set(key, { at: Date.now(), usd }); return usd; }
  } catch { /* unpriced */ }
  return null;
}

const ORACLE_ABI = parseAbi(["function oracleFor(address,address) view returns (address)"]);
const POOL_HEAD_ABI = parseAbi([
  "function token0() view returns (address)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, bool)",
]);
const DECIMALS_ABI = parseAbi(["function decimals() view returns (uint8)"]);

/**
 * A token's USD price from its BTB oracle pool against WETH, for tokens
 * DefiLlama does not cover (Robinhood Chain). Uses the pool's live tick.
 */
async function usdViaOracle(client: PublicClient, chainId: number, token: string): Promise<number | null> {
  const weth = AUTO_WETH[chainId];
  const pool = await client.readContract({ address: V6_REGISTRY as `0x${string}`, abi: ORACLE_ABI, functionName: "oracleFor", args: [token as `0x${string}`, weth as `0x${string}`] }).catch(() => null);
  if (!pool || /^0x0{40}$/.test(pool)) return null;
  const [t0, slot, decT, decW, eth] = await Promise.all([
    client.readContract({ address: pool, abi: POOL_HEAD_ABI, functionName: "token0" }),
    client.readContract({ address: pool, abi: POOL_HEAD_ABI, functionName: "slot0" }),
    client.readContract({ address: token as `0x${string}`, abi: DECIMALS_ABI, functionName: "decimals" }),
    client.readContract({ address: weth as `0x${string}`, abi: DECIMALS_ABI, functionName: "decimals" }),
    ethUsd(),
  ]);
  if (eth == null) return null;
  // Pool price is token1 per token0 in raw units.
  const raw = Math.pow(1.0001, Number(slot[1]));
  const tokenIs0 = t0.toLowerCase() === token.toLowerCase();
  const wethPerToken = tokenIs0 ? raw * 10 ** (decT - decW) : (1 / raw) * 10 ** (decT - decW);
  return wethPerToken * eth;
}

async function usdOf(chainId: number, token: string, client?: PublicClient): Promise<number | null> {
  const t = token.toLowerCase();
  if ((AUTO_STABLES[chainId] ?? []).includes(t)) return 1;
  if (AUTO_WETH[chainId] === t) return ethUsd();
  if (chainId === 8453) return llamaUsd(`base:${t}`);
  return client ? usdViaOracle(client, chainId, t).catch(() => null) : null;
}

/**
 * Swap-adapter params for selling `amountIn` of `tokenIn` for `tokenOut` through
 * KyberSwap, output to the wallet. The route is only a suggestion: the wallet
 * still refuses anything below the time-weighted price less its slippage limit.
 */
async function kyberSwap(chainId: number, wallet: string, tokenIn: string, tokenOut: string, amountIn: bigint): Promise<`0x${string}` | null> {
  const chain = KYBER_CHAIN[chainId];
  if (!chain) return null;
  const base = `https://aggregator-api.kyberswap.com/${chain.slug}/api/v1`;
  const headers = { "x-client-id": "btb-finance", "content-type": "application/json" };
  const route = await (await fetch(`${base}/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}`, { headers })).json();
  if (route?.code !== 0 || !route.data?.routeSummary) return null;
  const built = await (await fetch(`${base}/route/build`, {
    method: "POST", headers,
    body: JSON.stringify({ routeSummary: route.data.routeSummary, sender: wallet, recipient: wallet, slippageTolerance: chain.slippageBps }),
  })).json();
  const data = built?.data?.data as `0x${string}` | undefined;
  if (built?.code !== 0 || !data || (built.data.routerAddress as string).toLowerCase() !== KYBER_ROUTER.toLowerCase()) return null;
  return encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "uint256" }, { type: "bytes" }],
    [KYBER_ROUTER as `0x${string}`, tokenIn as `0x${string}`, tokenOut as `0x${string}`, amountIn, data],
  );
}

/**
 * Compound a staked position's rewards: unstake (which pays the rewards into
 * the wallet), sell them for the position's two tokens in its current mix, add
 * those to the position, and stake it again. The restake always runs, so a
 * failure half way leaves the position staked and the rest as spare tokens.
 */
async function compoundRewards(client: PublicClient, d: V3Deployment, o: {
  chainId: number; wallet: `0x${string}`; pm: `0x${string}`; adapter: `0x${string}`; tokenId: bigint; p: LiquidityPosition; gauge: `0x${string}`; stakedNow: boolean;
}): Promise<{ ok: boolean; wait?: string | null; note?: string }> {
  const send = sender(client, o.chainId, o.wallet);
  const t0 = o.p.token0.toLowerCase(), t1 = o.p.token1.toLowerCase();
  const weth = AUTO_WETH[o.chainId], aero = REWARD_TOKEN[o.chainId]?.address;
  if (!aero) return { ok: false, note: "No reward token here." };
  const hub = [t0, t1].includes(aero) ? aero : [t0, t1].includes(weth) ? weth : null;
  if (!hub) return { ok: false, note: "Reward compounding needs WETH or the reward token in the pair." };
  const pool = d.slipstream
    ? await client.readContract({ address: d.factory, abi: SLIP_FACTORY_ABI, functionName: "getPool", args: [o.p.token0, o.p.token1, o.p.tickSpacing ?? o.p.fee] })
    : await client.readContract({ address: d.factory, abi: UNI_FACTORY_ABI, functionName: "getPool", args: [o.p.token0, o.p.token1, o.p.fee] });
  if (!(await client.readContract({ address: V6_REGISTRY as `0x${string}`, abi: REGISTRY_ABI, functionName: "isListedPool", args: [pool] }))) {
    return { ok: false, note: "Reward compounding works on pools BTB lists." };
  }
  // The other token's share of the position by value, which is how much of the hub to swap into it.
  const other = hub === t0 ? t1 : t0;
  const [usd0, usd1] = await Promise.all([usdOf(o.chainId, t0, client), usdOf(o.chainId, t1, client)]);
  if (usd0 == null || usd1 == null) return { ok: false, note: "Could not price the pair." };
  const v0 = Number(o.p.amount0) / 10 ** o.p.decimals0 * usd0, v1 = Number(o.p.amount1) / 10 ** o.p.decimals1 * usd1;
  const otherShare = (other === t0 ? v0 : v1) / Math.max(v0 + v1, 1e-12);

  const bal = (t: string) => client.readContract({ address: t as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [o.wallet] });
  if (o.stakedNow) {
    const r = await send(V6.aerodromeAdapter, gaugeParams(Action.Unstake, o.gauge, o.tokenId));
    if (!r.ok) return { ok: false, wait: r.name && WAIT_REASONS[r.name] ? WAIT_REASONS[r.name] : null, note: r.name ?? r.message };
  }
  try {
    const before0 = await bal(t0), before1 = await bal(t1);
    const swap = async (tokenIn: string, tokenOut: string, amountIn: bigint) => {
      if (amountIn <= 0n) return true;
      const params = await kyberSwap(o.chainId, o.wallet, tokenIn, tokenOut, amountIn);
      return !!params && (await send(V6.swapAdapter, params)).ok;
    };
    // 1. All rewards into the hub token (unless the rewards are the hub).
    if (hub !== aero) {
      const rewards = await bal(aero);
      if (!(await swap(aero, hub, rewards))) return { ok: false, note: "The reward swap was refused; it is retried later." };
    }
    // 2. The other token's share of what the rewards brought in.
    const hubGain = (await bal(hub)) - (hub === t0 ? before0 : before1);
    if (!(await swap(hub, other, (hubGain * BigInt(Math.round(otherShare * 10_000))) / 10_000n))) {
      return { ok: false, note: "The second swap was refused; it is retried later." };
    }
    // 3. Add exactly what the rewards became.
    const a0 = (await bal(t0)) - before0, a1 = (await bal(t1)) - before1;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
    const added = await send(o.adapter, compoundParams(o.pm, o.tokenId, a0 > 0n ? a0 : 0n, a1 > 0n ? a1 : 0n, deadline));
    return added.ok ? { ok: true } : { ok: false, note: added.name ?? added.message };
  } finally {
    await send(V6.aerodromeAdapter, gaugeParams(Action.Stake, o.gauge, o.tokenId)).catch(() => null);
  }
}

async function push(ctx: ActionCtx, address: string, label: string, kind: string, title: string, message: string) {
  await ctx.runMutation(internal.alerts.pushEvent, { address, kind, label, message });
  await ctx.scheduler.runAfter(0, internal.pushActions.sendPush, { address, title, body: message, url: "/portfolio" });
}

/**
 * One scheduled check of one position. Reads it, charges the check, and when
 * it is out of range and the balance can pay, has the agent rebalance it
 * through the owner's V6 wallet (unstaking and restaking when it was staked).
 * Always leaves the row scheduled for its next check, or paused with a reason.
 */
export const check = internalAction({
  args: { id: v.id("autoRebalances"), gen: v.float64(), retry: v.optional(v.boolean()) },
  handler: async (ctx, { id, gen, retry }) => {
    const job = await ctx.runQuery(internal.autoRebalance.get, { id });
    if (!job || !job.active || job.gen !== gen) return;
    const intervalMs = job.intervalMin * 60_000;
    const client = getChainClient(job.chainId);
    const d = deploymentFor(job.chainId, job.positionManager);
    const adapter = adapterFor(job.chainId, job.positionManager);
    if (!client || !d || !adapter) { await ctx.runMutation(internal.autoRebalance.markGone, { id, note: "This position is no longer supported." }); return; }
    const wallet = job.wallet as `0x${string}`;
    const pm = job.positionManager as `0x${string}`;
    const tokenId = BigInt(job.tokenId);

    // Where is the NFT: in the wallet, or staked by the wallet in its gauge?
    let staked = false;
    try {
      const holder = (await client.readContract({ address: pm, abi: NFT_ABI, functionName: "ownerOf", args: [tokenId] })).toLowerCase();
      if (holder !== wallet.toLowerCase()) {
        staked = !!job.gauge && await stakedIn(client, job.chainId, pm, job.gauge, holder, wallet, tokenId);
        if (!staked) { await ctx.runMutation(internal.autoRebalance.markGone, { id, note: "The position left the auto wallet." }); return; }
      }
    } catch (e) {
      if (revertName(e) != null || (e instanceof BaseError && e.walk((x) => x instanceof ContractFunctionRevertedError))) {
        await ctx.runMutation(internal.autoRebalance.markGone, { id, note: "The position no longer exists." });
        return;
      }
      await ctx.runMutation(internal.autoRebalance.recordFailure, { id, gen, note: "Could not read the position; retrying.", max: MAX_FAILURES, nextInMs: RETRY_MS });
      return;
    }

    let inRange: boolean;
    let besidePrice = false;
    let position: LiquidityPosition | null = null;
    try {
      const [pos] = await fetchV3Positions(client, wallet, d, [tokenId]);
      if (!pos) { await ctx.runMutation(internal.autoRebalance.markGone, { id, note: "The position is empty." }); return; }
      inRange = pos.inRange;
      position = pos;
      // A one-sided position already right beside the price (a single-sided
      // add waiting to be filled) would be re-minted in the same place: moving
      // it would cost a rebalance and change nothing.
      const spacing = pos.tickSpacing ?? d.tickSpacings[pos.fee];
      if (!inRange && spacing) {
        besidePrice = pos.currentTick < pos.tickLower
          ? pos.tickLower - pos.currentTick <= spacing
          : pos.currentTick - pos.tickUpper < spacing;
      }
    } catch {
      await ctx.runMutation(internal.autoRebalance.recordFailure, { id, gen, note: "Could not read the position; retrying.", max: MAX_FAILURES, nextInMs: RETRY_MS });
      return;
    }

    // Paid only now that the read succeeded, and never twice for one check.
    const charged = await ctx.runMutation(internal.autoRebalance.recordCheck, { id, gen, inRange, charge: !retry, snapshot: packPosition(position), staked });
    if (!charged.ok) {
      if (charged.broke) await push(ctx, job.address, job.label, "auto", "Auto-rebalance paused", `${job.label}: auto-rebalance paused, your BTB balance ran out.`);
      return;
    }
    if (inRange) {
      // Auto-compound: an in-range, unstaked position whose fees are worth
      // several times the compound price. Staked positions earn gauge
      // rewards, not fees, so there is nothing to put back.
      const rewardsDue = job.compound && !!job.gauge && !isFarmManager(job.chainId, pm) && position && (REWARD_COMPOUND_CHAINS as readonly number[]).includes(job.chainId)
        && Date.now() - (job.lastCompoundedAt ?? 0) >= COMPOUND_COOLDOWN_MS;
      if (rewardsDue && position) {
        // Staked: value the rewards waiting in the gauge plus any already in the wallet.
        const cost = compoundBtb(job.chainId);
        const reward = REWARD_TOKEN[job.chainId];
        const [earned, held, aeroUsd] = await Promise.all([
          staked ? client.readContract({ address: job.gauge as `0x${string}`, abi: GAUGE_EARNED_ABI, functionName: "earned", args: [wallet, tokenId] }).catch(() => 0n) : Promise.resolve(0n),
          client.readContract({ address: reward.address as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [wallet] }).catch(() => 0n),
          usdOf(job.chainId, reward.address, client),
        ]);
        const value = aeroUsd == null ? null : Number(earned + held) / 1e18 * aeroUsd;
        if (value != null && value >= compoundMinUsd(job.chainId)
          && (await ctx.runQuery(internal.autoRebalance.available, { address: job.address })) >= cost
          && (await ctx.runMutation(internal.autoRebalance.acquireLock, { chainId: job.chainId, ms: 8 * 60_000 }))) {
          try {
            const done = await compoundRewards(client, d, { chainId: job.chainId, wallet, pm, adapter, tokenId, p: position, gauge: job.gauge as `0x${string}`, stakedNow: staked });
            if (done.ok) {
              await ctx.runMutation(internal.autoRebalance.recordCompound, { id });
              await push(ctx, job.address, job.label, "auto", "Rewards compounded", `${job.label}: about $${value.toFixed(2)} of ${reward.symbol} was sold into the position and it is staked again. ${cost.toLocaleString("en-US")} BTB used.`);
            }
          } catch { /* retried at a later check; nothing is charged */ }
          finally { await ctx.runMutation(internal.autoRebalance.releaseLock, { chainId: job.chainId }); }
        }
      } else if (job.compound && !staked && position && Date.now() - (job.lastCompoundedAt ?? 0) >= COMPOUND_COOLDOWN_MS) {
        const value = await feesUsd(job.chainId, position).catch(() => null);
        const cost = compoundBtb(job.chainId);
        if (value != null && value >= compoundMinUsd(job.chainId)
          && (await ctx.runQuery(internal.autoRebalance.available, { address: job.address })) >= cost
          && (await ctx.runMutation(internal.autoRebalance.acquireLock, { chainId: job.chainId, ms: 5 * 60_000 }))) {
          try {
            const done = await compoundFees(client, d, { chainId: job.chainId, wallet, pm, adapter, tokenId, p: position });
            if (done.ok) {
              await ctx.runMutation(internal.autoRebalance.recordCompound, { id });
              await push(ctx, job.address, job.label, "auto", "Fees compounded", `${job.label}: about $${value.toFixed(2)} of fees went back into the position. ${cost.toLocaleString("en-US")} BTB used.`);
            }
          } catch { /* retried at a later check; nothing is charged */ }
          finally { await ctx.runMutation(internal.autoRebalance.releaseLock, { chainId: job.chainId }); }
        }
      }
      const after = await ctx.runQuery(internal.autoRebalance.get, { id });
      if (after?.active) await ctx.runMutation(internal.autoRebalance.settle, { id, gen: after.gen, status: "watching", nextInMs: intervalMs });
      return;
    }
    if (besidePrice) {
      await ctx.runMutation(internal.autoRebalance.settle, {
        id, gen, status: "watching", note: "Right next to the price, waiting for it to reach the range. Nothing to move.", nextInMs: intervalMs,
      });
      return;
    }

    // Out of range. The rebalance checks the pool's average price over the
    // TWAP window; a pool without that history would fail it after the unstake,
    // so check first and leave the position staked and untouched.
    if (position) {
      const pool = d.slipstream
        ? await client.readContract({ address: d.factory, abi: SLIP_FACTORY_ABI, functionName: "getPool", args: [position.token0, position.token1, position.tickSpacing ?? position.fee] })
        : await client.readContract({ address: d.factory, abi: UNI_FACTORY_ABI, functionName: "getPool", args: [position.token0, position.token1, position.fee] });
      if (!(await hasPriceHistory(client, pool, lpConfig(job.chainId).twapWindow))) {
        const note = "Out of range. This pool does not record enough price history to rebalance safely, so it is left as it is.";
        if (job.note !== note) await push(ctx, job.address, job.label, "auto", "Cannot rebalance this pool", `${job.label}: ${note}`);
        await ctx.runMutation(internal.autoRebalance.settle, { id, gen, status: "waiting", note, nextInMs: intervalMs });
        return;
      }
    }

    // Only rebalance when the balance can pay for it.
    const cost = rebalanceBtb(job.chainId);
    const available = await ctx.runQuery(internal.autoRebalance.available, { address: job.address });
    if (available < cost) {
      const note = `Out of range. A rebalance needs ${cost.toLocaleString("en-US")} BTB; top up to let it run.`;
      if (job.status !== "short") await push(ctx, job.address, job.label, "auto", "Top up to rebalance", `${job.label} is out of range. ${note}`);
      await ctx.runMutation(internal.autoRebalance.settle, { id, gen, status: "short", note, nextInMs: intervalMs });
      return;
    }

    if (!(await ctx.runMutation(internal.autoRebalance.acquireLock, { chainId: job.chainId, ms: 5 * 60_000 }))) {
      // Another rebalance on this chain is sending; try again shortly without charging again.
      await ctx.runMutation(internal.autoRebalance.settle, { id, gen, status: job.status, note: job.note ?? undefined, nextInMs: 45_000, retry: true });
      return;
    }
    let result: Awaited<ReturnType<typeof execute>>;
    try {
      result = await execute(client, {
        chainId: job.chainId, wallet, pm, adapter, tokenId, stakedNow: staked,
        gauge: job.gauge as `0x${string}` | undefined,
      });
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      const note = /insufficient funds/i.test(text) ? "The BTB agent is waiting for gas; retrying." : "A rebalance transaction failed; retrying.";
      await ctx.runMutation(internal.autoRebalance.recordFailure, { id, gen, note, max: MAX_FAILURES, nextInMs: RETRY_MS });
      return;
    } finally {
      await ctx.runMutation(internal.autoRebalance.releaseLock, { chainId: job.chainId });
    }

    if (result.newTokenId != null) {
      await ctx.runMutation(internal.autoRebalance.recordRebalance, { id, newTokenId: result.newTokenId.toString(), staked: result.staked });
      const tail = job.gauge && !result.staked ? " It is not staked right now; the gauge refused it." : "";
      await push(ctx, job.address, job.label, "auto", "Rebalanced", `${job.label} was out of range and has been moved next to the price. ${cost.toLocaleString("en-US")} BTB used.${tail}`);
      const after = await ctx.runQuery(internal.autoRebalance.get, { id });
      if (after?.active) await ctx.runMutation(internal.autoRebalance.settle, { id, gen: after.gen, status: "watching", nextInMs: intervalMs });
      return;
    }
    if (result.wait) {
      await ctx.runMutation(internal.autoRebalance.settle, { id, gen, status: "waiting", note: result.wait, nextInMs: Math.min(intervalMs, 15 * 60_000) });
      return;
    }
    const why = result.error ?? "unknown";
    const failed = await ctx.runMutation(internal.autoRebalance.recordFailure, { id, gen, note: `Rebalance refused (${why}); retrying.`, max: MAX_FAILURES, nextInMs: RETRY_MS });
    if (failed.paused) await push(ctx, job.address, job.label, "auto", "Auto-rebalance paused", `${job.label}: auto-rebalance paused after repeated failures. Nothing was charged for them.`);
  },
});

// ── Enabling, from the app ──────────────────────────────────────────────────

type Result = { ok: true; id: Id<"autoRebalances"> } | { ok: false; reason: string };

/**
 * Start auto-rebalancing a position the owner has moved into their V6
 * wallet. The session proves the owner; the chain proves the rest: the wallet
 * is the owner's, the BTB agent is allowed in it, the adapter is enabled, and
 * the position sits in the wallet or in the wallet's gauge stake.
 */
export const enable = action({
  args: {
    sessionToken: v.string(), chainId: v.float64(), positionManager: v.string(), tokenId: v.string(),
    label: v.string(), gauge: v.optional(v.string()), intervalMin: v.float64(), compound: v.optional(v.boolean()),
  },
  handler: async (ctx, a): Promise<Result> => {
    const owner = await ctx.runQuery(internal.sessions.walletFor, { token: a.sessionToken });
    if (!owner) return { ok: false, reason: "Your sign-in expired. Sign in again." };
    if (!(CHECK_INTERVALS as readonly number[]).includes(a.intervalMin)) return { ok: false, reason: "Pick one of the listed intervals." };
    const adapter = adapterFor(a.chainId, a.positionManager);
    const client = getChainClient(a.chainId);
    if (!adapter || !client || !isAddress(a.positionManager)) return { ok: false, reason: "Auto-rebalance does not support this position yet." };
    if (a.gauge && !isAddress(a.gauge)) return { ok: false, reason: "Invalid gauge." };
    const pm = a.positionManager as `0x${string}`;
    const tokenId = BigInt(a.tokenId);

    const wallet = (await client.readContract({ address: V6.factory, abi: FACTORY_ABI, functionName: "accountOf", args: [owner as `0x${string}`] })).toLowerCase();
    if (/^0x0{40}$/.test(wallet)) return { ok: false, reason: "Your auto wallet is not created on this chain yet." };
    const [agentUntil, adapterHash, holder] = await Promise.all([
      client.readContract({ address: wallet as `0x${string}`, abi: WALLET_ABI, functionName: "agentExpiry", args: [REBALANCE_AGENT as `0x${string}`] }),
      client.readContract({ address: wallet as `0x${string}`, abi: WALLET_ABI, functionName: "adapterCodeHash", args: [adapter] }),
      client.readContract({ address: pm, abi: NFT_ABI, functionName: "ownerOf", args: [tokenId] }).catch(() => null),
    ]);
    if (Number(agentUntil) * 1000 < Date.now() + 24 * 60 * 60_000) return { ok: false, reason: "The BTB agent is not allowed in your auto wallet." };
    if (/^0x0{64}$/.test(adapterHash)) return { ok: false, reason: "This DEX is not turned on in your auto wallet." };
    const held = holder?.toLowerCase() === wallet;
    const stakedHere = !!a.gauge && !!holder && await stakedIn(client, a.chainId, pm, a.gauge, holder, wallet, tokenId).catch(() => false);
    if (!held && !stakedHere) return { ok: false, reason: "The position is not in your auto wallet yet." };

    const id = await ctx.runMutation(internal.autoRebalance.upsertVerified, {
      address: owner, wallet, chainId: a.chainId, positionManager: pm, tokenId: a.tokenId,
      label: a.label.slice(0, 80), gauge: a.gauge, intervalMin: a.intervalMin, compound: a.compound,
    });
    return { ok: true, id };
  },
});
