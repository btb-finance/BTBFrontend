import { query } from "./_generated/server";

export const listAllPrices = query({
  handler: async (ctx) => ctx.db.query("tokenPrices").collect(),
});
