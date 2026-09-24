import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { erc20Abi, formatUnits, isHash, parseEventLogs, type PublicClient } from "viem";
import { getChainClient } from "../src/lib/chainClient";
import { BTB_USD } from "./autoRebalanceConfig";
import { DEPOSIT_MAX_AGE_MS } from "./alertMessages";
import { TOP_UP_ASSETS, TOP_UP_CHAIN_NAMES, TOP_UP_MIN_USD, TOP_UP_TREASURY } from "./topUpConfig";

async function ethUsd(): Promise<number | null> {
  try {
    const usd = (await (await fetch("https://coins.llama.fi/prices/current/coingecko:ethereum")).json())?.coins?.["coingecko:ethereum"]?.price;
    return typeof usd === "number" && usd > 0 ? usd : null;
  } catch { return null; }
}

/** Prices for the top-up form: BTB at the app's fixed price, and ETH now. */
export const quote = action({
  args: {},
  handler: async (): Promise<{ btbUsd: number; ethUsd: number | null; treasury: string }> =>
    ({ btbUsd: BTB_USD, ethUsd: await ethUsd(), treasury: TOP_UP_TREASURY }),
});

type Result = { ok: true; btb: number; usd: number } | { ok: false; reason: string };

/**
 * Credit a payment to the treasury on any supported chain: native ETH sent
 * straight to it, or an accepted stablecoin transferred to it, at the fixed
 * BTB price. Only the wallet that signed the transaction and sent the money is
 * credited, once per transaction, within a day of paying.
 */
export const creditPayment = action({
  args: { chainId: v.float64(), txHash: v.string() },
  handler: async (ctx, { chainId, txHash }): Promise<Result> => {
    const hash = txHash.trim().toLowerCase();
    const assets = TOP_UP_ASSETS[chainId];
    if (!assets) return { ok: false, reason: "Payments are accepted on Base, Robinhood Chain and Ethereum." };
    if (!isHash(hash)) return { ok: false, reason: "That is not a transaction hash." };
    const client = getChainClient(chainId) as PublicClient | null;
    if (!client) return { ok: false, reason: "That chain is not available right now." };
    const where = TOP_UP_CHAIN_NAMES[chainId];
    const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` }).catch(() => null);
    if (!receipt) return { ok: false, reason: `Transaction not found on ${where} yet. It is checked again in a moment.` };
    if (receipt.status !== "success") return { ok: false, reason: "That transaction failed on-chain." };
    const to = TOP_UP_TREASURY.toLowerCase();
    const [tx, block] = await Promise.all([
      client.getTransaction({ hash: hash as `0x${string}` }),
      client.getBlock({ blockNumber: receipt.blockNumber }),
    ]);
    if (Date.now() - Number(block.timestamp) * 1000 > DEPOSIT_MAX_AGE_MS) return { ok: false, reason: "This payment is more than a day old and can no longer be credited." };

    // What reached the treasury, and from whom.
    const payers = new Set<string>();
    let usd = 0;
    const paid: { symbol: string; amount: number }[] = [];
    if (tx.to?.toLowerCase() === to && tx.value > 0n) {
      const eth = await ethUsd();
      if (eth == null) return { ok: false, reason: "Could not price ETH right now. Try again in a minute." };
      const amount = Number(formatUnits(tx.value, 18));
      usd += amount * eth;
      payers.add(tx.from.toLowerCase());
      paid.push({ symbol: "ETH", amount });
    }
    const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs }).filter((l) => l.args.to.toLowerCase() === to);
    let btbPaid = 0;
    for (const asset of assets.filter((a) => a.address && (a.stable || a.btb))) {
      const mine = transfers.filter((l) => l.address.toLowerCase() === asset.address!.toLowerCase());
      if (mine.length === 0) continue;
      const amount = Number(formatUnits(mine.reduce((s, l) => s + l.args.value, 0n), asset.decimals));
      // BTB is credited one for one; dollars and ETH at the fixed BTB price.
      if (asset.btb) btbPaid += amount;
      else usd += amount;
      mine.forEach((l) => payers.add(l.args.from.toLowerCase()));
      paid.push({ symbol: asset.symbol, amount });
    }
    if (paid.length === 0) return { ok: false, reason: `No ${["ETH", ...assets.filter((a) => a.address).map((a) => a.symbol)].join(", ")} was sent to the BTB Safe in that transaction.` };
    if (payers.size > 1) return { ok: false, reason: "That transaction pays from several wallets. Pay from one wallet." };
    // Only the wallet that signed the payment is credited, and only when the money came from that same wallet,
    // so nobody can turn someone else's payment into their own balance or pay into someone else's.
    const [payer] = [...payers];
    if (payer !== tx.from.toLowerCase()) return { ok: false, reason: "Pay straight from your own wallet: the money has to come from the wallet that sends the transaction." };
    const price = BTB_USD;
    if (usd + btbPaid * price < TOP_UP_MIN_USD) return { ok: false, reason: `Pay at least $${TOP_UP_MIN_USD} (${Math.ceil(TOP_UP_MIN_USD / price).toLocaleString("en-US")} BTB).` };
    const btb = Math.floor(usd / price + btbPaid);
    usd += btbPaid * price;
    const { ok } = await ctx.runMutation(internal.topUp.recordPayment, {
      chainId, txHash: hash, payer, usd, btbPrice: price, btb, paid: paid.map((p) => `${p.amount} ${p.symbol}`).join(" + "),
    });
    if (!ok) return { ok: false, reason: "That payment was already credited." };
    return { ok: true, btb, usd };
  },
});
