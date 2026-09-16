# BTB Finance

The web app for [BTB Finance](https://btb.finance): one place for the whole liquidity provider loop. Find a pool, simulate a range, add the position, claim, stake, rebalance and remove it, and get paid every Friday for using the app.

Built with Next.js 16, React 19, TypeScript, wagmi and viem, with Convex as the backend.

## What the app does

| Tab | What it does |
|---|---|
| Dashboard | Daily check-in, XP streak and the weekly BTB payout. |
| Discover | Pools ranked by APR, TVL and 24h volume across supported chains, with your own holdings first. New DEXes appear automatically from the DexScreener and GeckoTerminal registries. |
| Simulate | Fee, impermanent loss and range analysis for any pair on any supported chain, with a 30-day backtest and liquidity depth. Cross-chain research compares one pair across chains. |
| Portfolio | Every token and LP position you hold. Claim, stake, unstake, remove and rebalance from the same card. Several wallets can be linked into one profile. |
| Swap | Best price across DEXes on 17 chains through KyberSwap, plus bridging through LI.FI. |

Full LP management (add, manage, rebalance, stake) covers:

| Chain | DEXes |
|---|---|
| Ethereum | Uniswap V3, Uniswap V4, PancakeSwap V3, SushiSwap V3 |
| Base | Uniswap V3, Uniswap V4, PancakeSwap V3, Aerodrome Slipstream with gauge staking |
| BNB Chain | Uniswap V3, Uniswap V4, PancakeSwap V3 |
| Robinhood Chain | Uniswap V3, Uniswap V4, PancakeSwap V3, SushiSwap V3, Giga V3 with MasterChef staking, Ramses V3, UP with gauge staking |
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
npx tsc --noEmit -p .  # typecheck the app
npx convex dev         # run Convex functions against your dev deployment
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
