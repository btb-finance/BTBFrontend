/**
 * The ABI store behind the MCP connector's get_abi / read_contract / build_tx.
 * One row per chain + address. The first agent to ask about a contract pays
 * the lookup (abisActions.resolve); everyone after reads the row until it
 * expires (verified: 90 days, proxies and unknown addresses: 1 day, bytecode
 * guesses: 7 days, see abiTtlMs).
 */
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const abiKey = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`;

export const get = query({
  args: { chainId: v.float64(), address: v.string() },
  handler: async (ctx, { chainId, address }) => {
    const row = await ctx.db.query("abis").withIndex("by_key", (q) => q.eq("key", abiKey(chainId, address))).unique();
    if (!row || row.expiresAt < Date.now()) return null;
    return row.json;
  },
});

export const put = internalMutation({
  args: { chainId: v.float64(), address: v.string(), json: v.string(), source: v.string(), ttlMs: v.float64() },
  handler: async (ctx, { chainId, address, json, source, ttlMs }) => {
    const key = abiKey(chainId, address);
    const now = Date.now();
    const fields = { json, source, updatedAt: now, expiresAt: now + ttlMs };
    const existing = await ctx.db.query("abis").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert("abis", { key, ...fields });
  },
});
