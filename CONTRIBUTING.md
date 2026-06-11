# Contributing to BTB Finance

BTB is building the **everything app for DeFi** — manage LPs, vote-earn, lending, borrowing, and vaults across all protocols (Uniswap, Aerodrome, Blackhole, Ramses, Aave, Morpho, Beefy, and more) from one screen. See the [README](./README.md) for the full vision.

We're looking for **developers, designers, testers, and AI enthusiasts** who want to help improve BTB Finance.

If you enjoy building with AI tools and can spend some time improving our products, we'd love your help.

GitHub: https://github.com/btb-finance/BTBFrontend

## What we're offering

- **BTB token rewards** for valuable contributions
- **Weekly recognition** of contributors
- The opportunity to help **shape the future of the ecosystem**
- Contributors may receive a **share of rewards over time** based on the impact of their work

> There is no fixed payment schedule or guaranteed amount. Rewards are based on contribution quality, usefulness, and long-term value to the project.

## Ways to contribute

Every meaningful contribution matters:

- 🐛 **Fixing bugs**
- 🎨 **Improving UI/UX**
- ✨ **Adding features**
- 📝 **Writing documentation**
- 🧪 **Testing** the app and reporting issues
- 💡 **Suggesting ideas** via GitHub issues

## Getting started

1. **Fork** the repo and clone your fork:

   ```bash
   git clone https://github.com/<your-username>/BTBFrontend.git
   cd BTBFrontend
   ```

2. **Install dependencies** (we use [Bun](https://bun.sh), but npm works too):

   ```bash
   bun install
   ```

3. **Run the dev server**:

   ```bash
   bun run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

4. **Create a branch**, make your changes, and **submit a pull request** against `main`.

5. Before pushing, make sure lint and build pass:

   ```bash
   bun run lint
   bun run build
   ```

## Project structure — the most important rule

**Everything shared lives in ONE place. Each app/protocol gets its OWN folder. Never duplicate code.**

For example: there is one shared button/glass-card style for the whole app. Do **not** write your own button styles inside a screen or protocol file — use (or extend) the shared component so every part of the app stays consistent.

```
src/
├── app/                  # Next.js App Router (routes, layout, SEO, metadata)
├── components/           # GLOBAL shared UI — used by everything
│   ├── Glass.tsx         #   shared glass card / surface primitives
│   ├── Icon.tsx          #   shared icon system
│   ├── TokenIcon.tsx     #   shared token icons
│   ├── design-tokens.ts  #   shared colors, spacing, typography tokens
│   ├── TabBar.tsx        #   global navigation
│   ├── SendModal.tsx     #   shared modals
│   └── screens/          #   one file per app screen (Home, Swap, Earn, Stake…)
├── protocols/            # Each protocol/app has its OWN folder
│   ├── dexs/             #   DEX integrations (e.g. Uniswap)
│   ├── lending/
│   ├── bridge/
│   ├── perps/
│   ├── vaults/
│   ├── ...               #   options, launchpad, insurance, rwa, cdp,
│   │                     #   liquid-staking, liquid-restaking
│   └── types.ts          #   shared protocol types
├── lib/                  # GLOBAL logic — wallet, RPC, tx tracking, price APIs
│   ├── wagmi.ts          #   wallet/chain config
│   ├── txRunner.ts       #   shared transaction runner
│   ├── TxTracker.tsx     #   global transaction tracker
│   └── ...               #   API clients (Alchemy, Zapper, DefiLlama, Kyber…)
└── contracts/            # Shared ABIs and contract addresses
```

### Rules of thumb

- **Adding a new protocol or app?** Create a new folder under `src/protocols/<your-protocol>/` and keep all of its logic there.
- **Adding a new screen?** Put it in `src/components/screens/` and wire it into the `TabBar`.
- **Need a button, card, modal, icon, color, or spacing value?** It already exists — use the shared components in `src/components/` and the values in `design-tokens.ts`. If something is missing, **add it to the shared layer once** so everyone can use it, instead of writing a one-off.
- **Need wallet, transaction, or price-data logic?** Use the shared hooks and clients in `src/lib/` (e.g. `txRunner.ts` for sending transactions) — don't roll your own.
- **Same rule for everything**: if two places need it, it belongs in a shared folder, not copied into both.

Pull requests that duplicate existing shared code (custom buttons, ad-hoc styles, one-off transaction logic) will be asked to refactor before merging.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com)
- [wagmi](https://wagmi.sh) + [viem](https://viem.sh) for wallets & onchain reads/writes
- [Convex](https://convex.dev) for backend data
- [Bun](https://bun.sh) as the package manager

## Pull request guidelines

- Keep PRs **focused** — one fix or feature per PR.
- Describe **what** you changed and **why** in the PR description (screenshots for UI changes help a lot).
- Follow the existing folder structure and shared-component rules above.
- Make sure `bun run lint` and `bun run build` pass.
- Be responsive to review feedback — we review regularly and recognize contributors weekly.

## Questions or ideas?

Open a [GitHub issue](https://github.com/btb-finance/BTBFrontend/issues) or start a discussion. Whether it's a bug report, a design suggestion, or a new protocol idea — all contributions are welcome.

**Fork the repo, submit a pull request, and start building with us.** 🚀
