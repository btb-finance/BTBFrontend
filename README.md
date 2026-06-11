# BTB Finance Frontend

The frontend for [BTB Finance](https://github.com/btb-finance/BTBFrontend) — built with [Next.js](https://nextjs.org), React, TypeScript, Tailwind CSS, and wagmi/viem.

## What is BTB Finance?

**BTB is building the everything app for DeFi.** Instead of opening ten different apps to manage your positions, you do it all from one screen.

Today, DeFi is fragmented: your LPs are on one site, your votes on another, your loans on a third. BTB brings them all together:

- 🌊 **Liquidity providing** — Are you an LPer? Add and manage LP positions across **all projects from the same screen**. No need to open each app separately — Uniswap, Aerodrome, and more, all in one place.
- 🗳️ **Voting & vote-earn** — Are you a voter? Vote and earn across ve(3,3) DEXs like **Aerodrome, Blackhole, Ramses**, and others — every voting market available from one interface.
- 🏦 **Lending & borrowing** — Lend and borrow through protocols like **Aave, Morpho**, and more, without leaving BTB.
- 🌾 **Vaults & yield** — Access auto-compounding vaults and yield strategies like **Beefy** and other aggregators.
- 🔄 **And everything else** — swaps, perps, options, bridges, liquid staking/restaking, RWAs, launchpads, and insurance — each protocol category lives in its own folder under [`src/protocols/`](./src/protocols/), and the list keeps growing.

One wallet connection, one transaction tracker, one consistent interface — every protocol, one app.

## Contributing

We're looking for developers, designers, testers, and AI enthusiasts to help improve BTB Finance. Contributors earn **BTB token rewards** and weekly recognition based on the impact of their work.

👉 See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for how to get started, the project structure, and our shared-component rules.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Optional environment variables

Pool discovery on the Earn tab reads Uniswap V3 + V4 pools (TVL, 24h volume, fees, APR) straight from Uniswap's official subgraphs. That needs a free [Graph API key](https://thegraph.com/studio/apikeys/) in `.env.local`:

```bash
NEXT_PUBLIC_GRAPH_KEY=your-key-here
```

Without a key the app still works — pools fall back to DeFiLlama's keyless API.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
