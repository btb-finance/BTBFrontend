---
name: manage-lps
description: Check and manage the user's LP positions under BTB Finance auto-management (automatic range resets and fee compounding), explain its costs, and help turn it on. Use when the user asks about their positions, whether they are in range, rebalances, compounding, or automating their LPs.
---

# Manage LP positions

1. **Status.** Ask for the wallet address if you do not have it (an address is public; never ask for a key or seed phrase). Call `auto_manage_status`.
   Report each position briefly:
   - pair and label, and whether it is in range (`lastInRange`);
   - status and any `note` (for example a paused job because the BTB balance ran out);
   - check interval, rebalances and compounds so far, and BTB spent;
   - the BTB balance and free actions left.
2. **Act on problems.**
   - Out of range and paused: the user tops up BTB or resumes it on the Portfolio page (`manageLink`).
   - Checks cost more than the position earns: suggest a longer interval. `auto_manage_setup` lists intervals and their daily cost.
   - Fees worth compounding but `compound` off: suggest turning compounding on.
   The user makes these changes on btb.finance after signing in with the wallet; you cannot change them.
3. **Turn it on.** `auto_manage_setup` explains how it works, what it costs per chain (Base, Robinhood Chain) and the free trial. Give the user the link and the steps.
4. **Review the pools.** For each managed pair, `search_pools` → `pool_details`. If its risk grade fell or its APR collapsed, say so and suggest alternatives with `compare_pools`. Moving liquidity is the user's decision, done in their own wallet.

Never claim to have changed, paused or moved anything yourself.
