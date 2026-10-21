import type { ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { setLiveRpcs } from "../src/lib/chainRpc";

/** When this server run last installed the tested RPC lists. Lists change every few hours; reloading every 10
 * minutes keeps each run current without a database read on every action. */
let loadedAt = 0;

/** Install the tested, ranked RPC lists (convex/rpcHealth.ts) for this run. Never throws: the hardcoded lists stay. */
export async function loadLiveRpcs(ctx: ActionCtx) {
  if (Date.now() - loadedAt < 10 * 60_000) return;
  try {
    setLiveRpcs(await ctx.runQuery(api.rpcHealth.list, {}));
    loadedAt = Date.now();
  } catch { /* keep whatever is installed, or the hardcoded backup */ }
}
