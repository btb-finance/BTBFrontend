"use node";
/**
 * Resolves and stores a contract's ABI on a cache miss (see abis.ts).
 *
 * Public because the MCP connector calls it with only a chain and an address:
 * it computes the ABI itself from public data and writes it under that key, so
 * a caller cannot store anything of its own choosing.
 */
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { abiTtlMs, resolveAbi } from "../src/lib/abi/resolve";

/** Convex documents are capped at 1 MiB; a larger ABI is returned but not stored. */
const MAX_STORED = 900_000;

export const resolve = action({
  args: { chainId: v.float64(), address: v.string() },
  handler: async (ctx, { chainId, address }): Promise<string> => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("address must be a 0x address");
    const hit = await ctx.runQuery(api.abis.get, { chainId, address });
    if (hit) return hit;
    const r = await resolveAbi(chainId, address);
    const json = JSON.stringify(r);
    if (json.length <= MAX_STORED) {
      await ctx.runMutation(internal.abis.put, { chainId, address, json, source: r.source, ttlMs: abiTtlMs(r) });
    }
    return json;
  },
});
