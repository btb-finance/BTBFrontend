import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";

/** The wallet a session token belongs to, or null when unknown or expired. */
export async function sessionWallet(ctx: QueryCtx, token: string | undefined): Promise<string | null> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await ctx.db.query("sessions").withIndex("by_token", (q) => q.eq("token", token)).unique();
  return row && row.expiresAt > Date.now() ? row.address : null;
}

export const walletFor = internalQuery({
  args: { token: v.string() },
  handler: (ctx, { token }) => sessionWallet(ctx, token),
});

/** Written by the signed startSession action only. Old sessions for the wallet are pruned. */
export const create = internalMutation({
  args: { token: v.string(), address: v.string(), expiresAt: v.float64(), nonce: v.optional(v.string()) },
  handler: async (ctx, { token, address, expiresAt, nonce }): Promise<boolean> => {
    const a = address.toLowerCase();
    const now = Date.now();
    // A signed login is good for one session: a copied signature (a Safe's is public) cannot open another.
    if (nonce && await ctx.db.query("sessions").withIndex("by_nonce", (q) => q.eq("nonce", nonce)).first()) return false;
    const old = await ctx.db.query("sessions").withIndex("by_address", (q) => q.eq("address", a)).collect();
    for (const r of old) if (r.expiresAt <= now) await ctx.db.delete(r._id);
    await ctx.db.insert("sessions", { token, address: a, expiresAt, createdAt: now, ...(nonce ? { nonce } : {}) });
    return true;
  },
});
