# BTB Finance plugin for Claude Code

Live liquidity pools across Base, Ethereum, BNB Chain, Robinhood Chain and more, with a risk grade per pool, LP plans, earnings estimates and BTB auto-management. Claude only reads: every deposit or setting is signed by you, in your own wallet, on btb.finance.

## Install

```
/plugin install btb-finance --marketplace btb-finance/BTBFrontend
```

or `claude plugin marketplace add btb-finance/BTBFrontend` then `claude plugin install btb-finance@btb-finance`.

## What you get

- **Connector** `btb` (https://btb.finance/api/mcp): `top_pools`, `search_pools`, `pool_details`, `compare_pools`, `best_pools_for`, `chain_summary`, `estimate_lp_earnings`, `token_safety`, `lp_plan`, `add_liquidity_link`, `auto_manage_status`, `auto_manage_setup`.
- **Skills**: `compare-pools`, `add-liquidity`, `manage-lps`.
- **Agent** `lp-manager`: researches pools, builds an LP plan for an amount, reviews a wallet's auto-managed positions and prepares the links you sign.

Try: "Compare the best ETH/USDC pools on Base", "Plan $10k across 3 low-risk pools", "How are the auto-managed LPs of 0x… doing?"

## claude.ai

The same connector works in claude.ai: Customize → Connectors → Add custom connector → `https://btb.finance/api/mcp`.

Figures are current snapshots and change. Not financial advice.
