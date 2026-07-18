"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildRobinhoodMarketFeed } from "../src/lib/robinhoodMarkets";

export const refresh = internalAction({
  args: {},
  handler: async (ctx) => {
    const markets = await buildRobinhoodMarketFeed();
    await ctx.runMutation(internal.markets.save, {
      json: JSON.stringify({ version: 1, markets }),
    });
  },
});
