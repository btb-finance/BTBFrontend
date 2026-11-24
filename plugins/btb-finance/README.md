# BTB Finance plugin for Claude Code

Live liquidity pools across Base, Ethereum, BNB Chain, Robinhood Chain and more, with a risk grade per pool, LP plans, earnings estimates and BTB auto-management. The connector never signs: people sign on btb.finance in their own wallet, and agents with their own wallet sign the unsigned transactions the build tools return.

## Install

```
/plugin install btb-finance --marketplace btb-finance/BTBFrontend
```

or `claude plugin marketplace add btb-finance/BTBFrontend` then `claude plugin install btb-finance@btb-finance`.

## What you get

- **Connector** `btb` (https://btb.finance/api/mcp): `top_pools`, `search_pools`, `pool_details`, `compare_pools`, `best_pools_for`, `chain_summary`, `estimate_lp_earnings`, `token_safety`, `lp_plan`, `add_liquidity_link`, `wallet_positions`, `auto_manage_status`, `auto_manage_setup`, for agents with their own wallet `build_swap` and `build_add_liquidity` (unsigned transactions with a dry run), and for any contract on any chain `get_abi`, `read_contract` and `build_tx`.
- **Skills**: `compare-pools`, `add-liquidity`, `manage-lps`.
- **Agent** `lp-manager`: researches pools, builds an LP plan for an amount, reviews every LP position a wallet holds (and its auto-managed ones) and prepares the links you sign.

Try: "Compare the best ETH/USDC pools on Base", "Plan $10k across 3 low-risk pools", "Show every LP position of 0x… and which are out of range"

## claude.ai

The same connector works in claude.ai: Customize → Connectors → Add custom connector → `https://btb.finance/api/mcp`.

Figures are current snapshots and change. Not financial advice.
