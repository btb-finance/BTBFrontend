# BTB Finance

The web app for [BTB Finance](https://btb.finance): one place for the whole liquidity provider loop. Find a pool, simulate a range, add the position, claim, stake, rebalance and remove it, and get paid every Friday for using the app.

Built with Next.js 16, React 19, TypeScript, wagmi and viem, with Convex as the backend.

## What the app does

| Tab | What it does |
|---|---|
| Home | Daily check-in, XP streak and the weekly BTB payout. |
| Discover | Pools ranked by APR, TVL and 24h volume across supported chains, with your own holdings first. New DEXes appear automatically from the DexScreener and GeckoTerminal registries. |
| Simulate | Fee, impermanent loss and range analysis for any pair on any supported chain, with a 30-day backtest and liquidity depth. Cross-chain research compares one pair across chains. |
| Portfolio | Every token and LP position you hold. Claim, stake, unstake, remove and rebalance from the same card. Several wallets can be linked into one profile. |
| Smart LPs | The LPs who stayed in range and beat holding on the pools we track. Copy any range in one tap. |
| Swap | Best price across DEXes on 18 chains through KyberSwap, plus bridging through LI.FI. |
| Agent | AI assistant that reads your portfolio, answers LP questions and flags risks. |
| Allocate | Which Aero pools pay your sAERO the most per day, the best split, and allocation in one step. |
| Token Scan | Grade any token on safety, liquidity, holders and flow, and get the LP range it calls for (`/scan`). |

Full LP management (add, manage, rebalance, stake) covers:

| Chain | DEXes |
|---|---|
| Ethereum | Uniswap V3, Uniswap V4, PancakeSwap V3, SushiSwap V3, Metric |
| Base | Uniswap V3, Uniswap V4, PancakeSwap V3, Aero and Aerodrome Slipstream with gauge staking |
| BNB Chain | Uniswap V3, Uniswap V4, PancakeSwap V3, Metric |
| Robinhood Chain | Uniswap V3, Uniswap V4, PancakeSwap V3, SushiSwap V3, Aero, Giga V3 with MasterChef staking, Ramses V3, UP with gauge staking, Alandale, Metric |
| Arc | Uniswap V3, Uniswap V4, Aerodrome Slipstream |

Other chains are covered by Discover and Simulate only.

The LP tools are free. BTB takes a 1% fee on swaps routed through the app and shares that revenue with users every Friday in proportion to the XP they earned that week. The in-app manual at `/docs` describes every flow.

## Running locally

```bash
yarn install
yarn dev
```

Open http://localhost:3000. The repo uses yarn; `yarn.lock` is the only lockfile and it is what Netlify installs from.

Other useful commands:

```bash
yarn build             # production build
yarn typecheck         # typecheck the app
yarn lint              # oxlint
npx convex dev --once  # push Convex functions to the live backend (grateful-oyster-780)
```

## Environment

Copy `.env.example` to `.env.local`. The app runs with an empty file; each variable unlocks one thing.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | The Convex deployment the app talks to (Discover snapshot, rewards, profiles). |
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect project id. A shared default is built in. |
| `NEXT_PUBLIC_GRAPH_KEY` | Graph API key for Uniswap subgraph history in the simulator. Without it the app uses keyless sources. |
| `NEXT_PUBLIC_BTB_SWAP_FEE_RECEIVER` | Address that receives the swap fee. |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Extra Robinhood Chain RPC added to the failover pool. |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex HTTP actions URL (daily check-in). Defaults to the live deployment. |
| `NEXT_PUBLIC_ALCHEMY_KEY` | Alchemy key for balances on other chains. Without it that fallback is skipped. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push public key for LP range alerts. |
| `LIFI_INTEGRATOR`, `LIFI_FEE` | LI.FI integrator id and optional bridge fee. |

Convex-side secrets (rewards payout key, agent key, cron switches) are set on the Convex dashboard, not in `.env.local`.

## Project layout

```
src/app/            Next.js routes: the app shell per tab, /discover/[chain], /vs comparison pages, SEO files
src/components/     Screens and shared UI (Glass, Button, TopNav, CreatePosition, LpPositions, RebalanceFlow)
src/lib/            Data: pools and Discover pipeline, market data clients, RPC failover, token store, profile
src/protocols/      On-chain adapters: Uniswap V3 and V4, PancakeSwap, SushiSwap, Aerodrome, Robinhood forks, staking
convex/             Backend: Discover refresh and DEX coverage crons, rewards epochs, users and XP, profiles
```

Shared components are the rule: one button, one glass card, one table. See [CONTRIBUTING.md](./CONTRIBUTING.md) before adding UI.

## Contributing

Developers, designers and testers are welcome. Contributors earn BTB rewards and weekly recognition based on the impact of their work. [CONTRIBUTING.md](./CONTRIBUTING.md) covers setup, the project structure and the shared-component rules.

## Links

- App: https://btb.finance
- Docs: https://btb.finance/docs
- X: https://x.com/BTB_Finance
- Discord: https://discord.gg/bqFEPA56Tc

## BTB for Claude

- **Connector** (claude.ai, Claude Code, any MCP client): `https://btb.finance/api/mcp`. Read-only: pools, risk grades, LP plans, earnings estimates, auto-management status, and links the user signs on btb.finance. Code: `src/app/api/mcp`, `src/lib/mcp`.
- **Claude Code plugin** (connector, skills and the `lp-manager` agent): `/plugin install btb-finance --marketplace btb-finance/BTBFrontend`. Code: `plugins/btb-finance`.
