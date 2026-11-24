---
name: compare-pools
description: Find and compare liquidity pools with BTB Finance (APR, TVL, fees, risk grade) across Base, Ethereum, BNB Chain, Robinhood Chain and other chains. Use when the user asks for the best pools, the best yield for a token pair or an amount, which of several pools is better, or how a chain's yields look.
---

# Compare liquidity pools

Use the `btb` MCP tools. They read BTB Finance's live pool snapshot (refreshed hourly).

1. **Find candidates.**
   - A pair or token ("ETH/USDC", a token address, "aerodrome"): `search_pools`.
   - "Best pools" in general: `top_pools`. Pass `chain`, `maxRisk` (default to `B` unless the user wants more risk), `minTvlUsd` (keep the default $100k or more) and `sortBy`.
   - A sized position ("I have $50k"): `best_pools_for` with `amountUsd`. It skips pools where the position would be more than 2 % of the pool.
   - Chain overview: `chain_summary`.
2. **Compare.** Pass the 2–6 best keys to `compare_pools`. Read each pool's `riskReasons`, not just the grade.
3. **Answer with a short table**: pair, chain, DEX and fee, APR (and its kind), TVL, risk grade, and the link. Then say which pool you would look at first and why, in one or two sentences.

## Reading the numbers

- `aprKind: measured ±5% range APR` is what a ±5 % concentrated position really earned over `measuredDays`. It is better evidence than base APR. `vsHoldPct` shows the result against simply holding the tokens over the same window; a negative value means impermanent loss beat the fees.
- APRs above 200 % rarely last. Above 1,000 % usually means a new or thin pool.
- Risk grade: A (best) to E. It starts at 100 and subtracts for low TVL, a non-stable pair, a range that often left its range, a very high APR, and each token's safety scan. "No safety scan" costs 5 points per token; run `token_safety` on unknown tokens.
- `canAddOnBtb: false` means btb.finance can show the pool but cannot add liquidity to it directly yet.

Always say that these are current figures that change, and that this is not financial advice.
