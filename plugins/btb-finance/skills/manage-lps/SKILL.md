---
name: manage-lps
description: Check and manage the user's LP positions with BTB Finance - every position a wallet holds (value, range, fees) and the ones under auto-management (automatic range resets and fee compounding) - and help turn auto-management on. Use when the user asks about their positions, their value or fees, whether they are in range, rebalances, compounding, or automating their LPs.
---

# Manage LP positions

1. **Positions.** Ask for the wallet address if you do not have it (an address is public; never ask for a key or seed phrase). Call `wallet_positions` (pass `chain` when the user names one; all five chains take up to about 20 seconds).
   Report the totals (value, uncollected fees, how many in range), then each position: chain, DEX, pair, value, in range or not with the range against the current price, uncollected fees, staked or not, auto-managed or not. Mention anything listed under `notRead`.
2. **Auto-management.** Call `auto_manage_status`.
   Report each managed position briefly:
   - pair and label, and whether it is in range (`lastInRange`);
   - status and any `note` (for example a paused job because the BTB balance ran out);
   - check interval, rebalances and compounds so far, and BTB spent;
   - the BTB balance and free actions left.
3. **Act on problems.**
   - Out of range and not auto-managed: it earns no fees now; suggest rebalancing on btb.finance or turning on auto-management.
   - Uncollected fees worth more than the gas: suggest collecting them on the Portfolio page.
   - Out of range and paused: the user tops up BTB or resumes it on the Portfolio page (`manageLink`).
   - Checks cost more than the position earns: suggest a longer interval. `auto_manage_setup` lists intervals and their daily cost.
   - Fees worth compounding but `compound` off: suggest turning compounding on.
   The user makes these changes on btb.finance after signing in with the wallet; you cannot change them.
4. **Turn it on.** `auto_manage_setup` explains how it works, what it costs per chain (Base, Robinhood Chain) and the free trial. Give the user the link and the steps.
5. **Review the pools.** For each managed pair, `search_pools` → `pool_details`. If its risk grade fell or its APR collapsed, say so and suggest alternatives with `compare_pools`. Moving liquidity is the user's decision, done in their own wallet.

Never claim to have changed, paused or moved anything yourself.
