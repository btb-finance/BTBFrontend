/**
 * Manual BTB credit from the team, e.g. a support top-up so a wallet's
 * auto-rebalance keeps running. Internal only: it runs from the Convex CLI or
 * dashboard (`npx convex run adminCredit:grant`), never from the app.
 * `note` makes the grant idempotent: the same wallet and note credit once.
 */
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { addCredit, availableFor } from "./credit";

export const grant = internalMutation({
  args: { address: v.string(), btb: v.float64(), note: v.string() },
  handler: async (ctx, { address, btb, note }) => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("bad address");
    if (!(btb > 0) || btb > 10_000_000) throw new Error("amount out of range");
    const ok = await addCredit(ctx, address, btb, `grant:${address.toLowerCase()}:${note}`, "grant");
    return { ok, ...(await availableFor(ctx, address)) };
  },
});
