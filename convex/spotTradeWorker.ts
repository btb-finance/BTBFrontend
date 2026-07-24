"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

function messageOf(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason || "Spot trade failed");
}

function terminalFailure(message: string) {
  const value = message.toLowerCase();
  return [
    "invalid trade", "minimum instant trade", "no executable route", "no protected uniswap",
    "permission is disabled", "does not have trading permission", "not authorized", "expired",
    "insufficient balance", "transfer amount exceeds", "instant trade reverted", "unsafe transaction data",
  ].some(fragment => value.includes(fragment));
}

export const drain = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: boolean; locked?: boolean; state?: string; orderId?: Id<"spotTradeOrders">; error?: string }> => {
    const workerId = crypto.randomUUID();
    const claimed: { locked: boolean; retryAfter: number; order: Doc<"spotTradeOrders"> | null } = await ctx.runMutation(internal.spotTradeQueue.claim, { workerId });
    if (!claimed.order) {
      if (claimed.locked) await ctx.scheduler.runAfter(Math.min(5_000, Math.max(1_000, claimed.retryAfter)), internal.spotTradeWorker.drain, {});
      return { processed: false, locked: claimed.locked };
    }
    const order = claimed.order;
    try {
      const result = await ctx.runAction(internal.spotTrade.executeQueued, {
        chainId: order.chainId,
        account: order.account,
        router: order.router,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amountIn: order.amountIn,
        minimumGrossOutput: order.minimumGrossOutput,
        minimumProtocolFee: order.minimumProtocolFee,
        nonce: order.nonce,
        deadline: order.deadline,
        sessionSignature: order.sessionSignature,
        orderId: order._id,
        workerId,
        txHash: order.txHash,
        signedTransaction: order.signedTransaction,
      });
      await ctx.runMutation(internal.spotTradeQueue.complete, {
        orderId: order._id, workerId, txHash: result.hash,
        grossAmountOut: result.grossAmountOut,
        protocolFee: result.protocolFee,
        netAmountOut: result.netAmountOut,
        amountInUsd: result.amountInUsd || order.amountInUsd || 0,
      });
      await ctx.scheduler.runAfter(0, internal.spotTradeWorker.drain, {});
      return { processed: true, state: "confirmed", orderId: order._id };
    } catch (reason) {
      const error = messageOf(reason).slice(0, 600);
      const current: Doc<"spotTradeOrders"> | null = await ctx.runQuery(internal.spotTradeQueue.getInternal, { orderId: order._id });
      await ctx.runMutation(internal.spotTradeQueue.release, {
        orderId: order._id, workerId, error,
        terminal: terminalFailure(error),
      });
      await ctx.scheduler.runAfter(current?.txHash ? 2_000 : Math.min(30_000, 1_000 * 2 ** Math.max(0, order.attempts - 1)), internal.spotTradeWorker.drain, {});
      return { processed: true, state: current?.txHash ? "submitted" : "retry", orderId: order._id, error };
    }
  },
});
