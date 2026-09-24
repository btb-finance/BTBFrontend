import { action, internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  BaseError, ContractFunctionRevertedError, createWalletClient, defineChain, fallback, http, isAddress, parseAbi,
  parseEventLogs, type Chain, type PublicClient,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { getChainClient } from "../src/lib/chainClient";
import { chainTransport } from "../src/lib/chainRpc";
import { fetchV3Positions } from "../src/protocols/dexs/uniswap";
import { AERODROME_CL_DEPLOYMENTS } from "../src/protocols/dexs/aerodrome";
import { UP_V3_DEPLOYMENT } from "../src/protocols/dexs/robinhood";
import { uniswapV3DeploymentForChain, type V3Deployment } from "../src/protocols/dexs/uniswap/v3/addresses";
import {
  ADAPTER_ERRORS_ABI, Action, CHECK_INTERVALS, FACTORY_ABI, REBALANCE_AGENT, V6, WALLET_ABI, adapterFor, gaugeParams,
  rebalanceBtb, rebalanceParams,
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
  StakeTooRecent: "Out of range, waiting for the gauge's minimum stake time.",
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
async function execute(
  client: PublicClient,
  o: { chainId: number; wallet: `0x${string}`; pm: `0x${string}`; adapter: `0x${string}`; tokenId: bigint; gauge?: `0x${string}`; stakedNow: boolean },
) {
  const account = agentAccount();
  const walletClient = createWalletClient({ account, chain: CHAINS[o.chainId], transport: SEND_TRANSPORT[o.chainId] });
  const send = async (adapter: `0x${string}`, params: `0x${string}`): Promise<Sent> => {
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
  const stop = (r: Extract<Sent, { ok: false }>) => ({
    newTokenId: null, staked: false,
    wait: r.name && WAIT_REASONS[r.name] ? WAIT_REASONS[r.name] : null,
    error: r.name ?? r.message,
  });

  let unstaked = false;
  if (o.stakedNow && o.gauge) {
    const r = await send(V6.aerodromeAdapter, gaugeParams(Action.Unstake, o.gauge, o.tokenId));
    if (!r.ok) return stop(r);
    unstaked = true;
  }
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
  const r = await send(o.adapter, rebalanceParams(o.pm, o.tokenId, deadline));
  if (!r.ok) {
    if (unstaked && o.gauge) await send(V6.aerodromeAdapter, gaugeParams(Action.Stake, o.gauge, o.tokenId)).catch(() => null);
    return stop(r);
  }
  const minted = parseEventLogs({ abi: NFT_ABI, eventName: "Transfer", logs: r.logs }).find((l) =>
    l.address.toLowerCase() === o.pm.toLowerCase() && /^0x0{40}$/.test(l.args.from) && l.args.to.toLowerCase() === o.wallet.toLowerCase());
  if (!minted) return { newTokenId: null, staked: false, wait: null, error: "rebalance landed but no new position was found" };
  const newTokenId = minted.args.tokenId;
  // A refused restake leaves the new position safe in the wallet, unstaked.
  const staked = o.gauge ? (await send(V6.aerodromeAdapter, gaugeParams(Action.Stake, o.gauge, newTokenId)).catch(() => null))?.ok === true : false;
  return { newTokenId, staked, wait: null, error: null };
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
        staked = !!job.gauge && holder === job.gauge
          && await client.readContract({ address: job.gauge as `0x${string}`, abi: GAUGE_ABI, functionName: "stakedContains", args: [wallet, tokenId] });
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
    try {
      const [pos] = await fetchV3Positions(client, wallet, d, [tokenId]);
      if (!pos) { await ctx.runMutation(internal.autoRebalance.markGone, { id, note: "The position is empty." }); return; }
      inRange = pos.inRange;
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
    const charged = await ctx.runMutation(internal.autoRebalance.recordCheck, { id, gen, inRange, charge: !retry });
    if (!charged.ok) {
      if (charged.broke) await push(ctx, job.address, job.label, "auto", "Auto-rebalance paused", `${job.label}: auto-rebalance paused, your BTB balance ran out.`);
      return;
    }
    if (inRange) {
      await ctx.runMutation(internal.autoRebalance.settle, { id, gen, status: "watching", nextInMs: intervalMs });
      return;
    }
    if (besidePrice) {
      await ctx.runMutation(internal.autoRebalance.settle, {
        id, gen, status: "watching", note: "Right next to the price, waiting for it to reach the range. Nothing to move.", nextInMs: intervalMs,
      });
      return;
    }

    // Out of range. Only rebalance when the balance can pay for it.
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
    label: v.string(), gauge: v.optional(v.string()), intervalMin: v.float64(),
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
    const stakedHere = !!a.gauge && holder?.toLowerCase() === a.gauge.toLowerCase()
      && await client.readContract({ address: a.gauge as `0x${string}`, abi: GAUGE_ABI, functionName: "stakedContains", args: [wallet as `0x${string}`, tokenId] });
    if (!held && !stakedHere) return { ok: false, reason: "The position is not in your auto wallet yet." };

    const id = await ctx.runMutation(internal.autoRebalance.upsertVerified, {
      address: owner, wallet, chainId: a.chainId, positionManager: pm, tokenId: a.tokenId,
      label: a.label.slice(0, 80), gauge: a.gauge, intervalMin: a.intervalMin,
    });
    return { ok: true, id };
  },
});
