---
name: add-liquidity
description: Help the user add liquidity (open an LP position) on a pool through BTB Finance, or plan how to split an amount across several pools. Use when the user wants to provide liquidity, put money into a pool, build an LP portfolio, or asks what a position would earn.
---

# Add liquidity

You cannot sign transactions or hold keys, and you must never ask for a private key or seed phrase. Every deposit is made by the user, in their own wallet, on btb.finance, from a link you give them.

1. **Pick the pool(s).**
   - One pool the user named: `search_pools`, then `pool_details` for its risk and token scans.
   - An amount to spread: `lp_plan` with `amountUsd`, `chain` and `maxRisk` (default `B`). It picks one pool per pair, never more than 2 % of a pool.
2. **Check before recommending.**
   - Read `riskReasons`. If a token has no scan, run `token_safety`; if it is still unscanned, tell the user and give them the scan link.
   - Warn plainly about a honeypot, mint or blacklist powers, low TVL, or an APR above 200 %.
3. **Show what to expect.** `estimate_lp_earnings` for the amount over 30 days (or the user's horizon). Give both figures, the APR-based one and the last-24h-fees one, and explain impermanent loss for non-stable pairs.
4. **Give the link.** `add_liquidity_link` for each pool. Tell the user what happens there:
   - connect the wallet;
   - enter the amount (btb.finance suggests a range);
   - review and sign the approval and the mint in the wallet.
   If `canAddOnBtb` is false, say so and offer the closest pool that is addable.
5. **Offer auto-management** for the new position (see the `manage-lps` skill).

End with: figures change, this is not financial advice, and they should check every transaction in their wallet before signing.
