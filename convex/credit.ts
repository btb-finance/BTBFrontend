import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * The wallet's BTB balance inside the app. Fast range checks and agent
 * messages are paid from it. It is bookkeeping only: the BTB sits in the
 * treasury. Two things fill it: a BTB transfer to the treasury (pasted hash)
 * and, automatically when it runs short, the wallet's unclaimed weekly
 * rewards. The alertCredits table predates the agent charge and keeps its name.
 */

export async function creditRow(ctx: QueryCtx | MutationCtx, address: string) {
  return ctx.db.query("alertCredits").withIndex("by_address", (q) => q.eq("address", address.toLowerCase())).unique();
}

async function claimableRows(ctx: QueryCtx | MutationCtx, address: string) {
  const rows = await ctx.db.query("rewardPayouts").withIndex("by_wallet", (q) => q.eq("walletAddress", address.toLowerCase())).collect();
  return rows.filter((r) => r.state === "claimable").sort((a, b) => a.createdAt - b.createdAt);
}

const btbOf = (raw: string) => Number(BigInt(raw) / 10n ** 12n) / 1e6;

/** Balance plus unclaimed weekly rewards: everything a charge can draw on. */
export async function availableFor(ctx: QueryCtx | MutationCtx, address: string) {
  const [row, claimable] = await Promise.all([creditRow(ctx, address), claimableRows(ctx, address)]);
  const rewards = claimable.reduce((sum, r) => sum + btbOf(r.amountRaw), 0);
  return { balance: row?.balance ?? 0, rewards, total: (row?.balance ?? 0) + rewards, fast: row?.fast ?? false };
}

/**
 * Credit a wallet once per `ref`. Returns false when the ref was already used,
 * which is the whole guard against a transaction hash pasted twice: the
 * lookup and the insert run in one Convex transaction.
 */
export async function addCredit(ctx: MutationCtx, address: string, amount: number, ref: string, source: "tx" | "rewards" | "payment"): Promise<boolean> {
  const a = address.toLowerCase();
  const used = await ctx.db.query("alertDeposits").withIndex("by_ref", (q) => q.eq("ref", ref)).unique();
  if (used) return false;
  const now = Date.now();
  await ctx.db.insert("alertDeposits", { ref, address: a, amount, source, createdAt: now });
  const credit = await creditRow(ctx, a);
  if (credit) await ctx.db.patch(credit._id, { balance: credit.balance + amount, updatedAt: now });
  else await ctx.db.insert("alertCredits", { address: a, balance: amount, fast: false, updatedAt: now });
  return true;
}

/** Marks a paying epoch paid once every payout in it has settled one way or another. */
export async function closeEpochIfDrained(ctx: MutationCtx, epochId: number) {
  const remaining = await ctx.db
    .query("rewardPayouts").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).collect();
  // "alerts": moved into the in-app balance; its BTB never left the treasury.
  const done = new Set(["confirmed", "failed", "expired", "alerts"]);
  if (remaining.some((row) => !done.has(row.state))) return;
  const epoch = await ctx.db
    .query("rewardEpochs").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).unique();
  if (epoch && epoch.state === "paying") await ctx.db.patch(epoch._id, { state: "paid" });
}

/**
 * Take `amount` BTB from the wallet's balance. When the balance is short,
 * unclaimed weekly rewards are moved in first, oldest first, whole payouts at
 * a time. Returns false, and changes nothing, when even that is not enough.
 * Callers must already know the wallet agreed to pay: a signed switch for
 * fast checks, a signed session for the agent.
 */
export async function spendCredit(ctx: MutationCtx, address: string, amount: number): Promise<boolean> {
  const a = address.toLowerCase();
  const { total } = await availableFor(ctx, a);
  if (total < amount) return false;
  let row = await creditRow(ctx, a);
  if ((row?.balance ?? 0) < amount) {
    for (const payout of await claimableRows(ctx, a)) {
      await ctx.db.patch(payout._id, { state: "alerts", updatedAt: Date.now() });
      await addCredit(ctx, a, btbOf(payout.amountRaw), `payout:${payout._id}`, "rewards");
      await closeEpochIfDrained(ctx, payout.epochId);
      row = await creditRow(ctx, a);
      if ((row?.balance ?? 0) >= amount) break;
    }
  }
  if (!row || row.balance < amount) return false;
  await ctx.db.patch(row._id, { balance: row.balance - amount, updatedAt: Date.now() });
  return true;
}
