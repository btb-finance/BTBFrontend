import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { addCredit } from "./credit";

/**
 * Payments that topped up app BTB balances, kept for the treasury: each one is
 * money received on some chain that still has to be turned into BTB on
 * Ethereum (`bought` once it has been).
 */
export const recordPayment = internalMutation({
  args: { chainId: v.float64(), txHash: v.string(), payer: v.string(), usd: v.float64(), btbPrice: v.float64(), btb: v.float64(), paid: v.string() },
  handler: async (ctx, a) => {
    // One credit per transaction and chain; the same hash cannot be pasted twice.
    const ok = await addCredit(ctx, a.payer, a.btb, `pay:${a.chainId}:${a.txHash}`, "payment");
    if (!ok) return { ok: false };
    await ctx.db.insert("topUpPayments", { ...a, payer: a.payer.toLowerCase(), bought: false, createdAt: Date.now() });
    return { ok: true };
  },
});

/** What the treasury has received and still has to buy BTB for, per chain and asset. */
export const unbought = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("topUpPayments").withIndex("by_bought", (q) => q.eq("bought", false)).collect();
    return { count: rows.length, usd: rows.reduce((s, r) => s + r.usd, 0), btbCredited: rows.reduce((s, r) => s + r.btb, 0) };
  },
});
