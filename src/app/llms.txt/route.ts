export const dynamic = 'force-static';

// https://btb.finance/llms.txt: where AI agents and coding tools look first to learn how to use a site.
const BODY = `# BTB Finance

> DeFi data and ready-to-sign transactions for AI agents and developers, across Base, Ethereum, BNB Chain, Arbitrum, Optimism, Polygon, Unichain, Robinhood Chain and more. Compare every way to earn on a token (lending, vaults, savings, staking, liquidity pools), find and check tokens, quote and build swaps, lend on Aave, add liquidity from one token, read wallets, and call any contract, with dry runs. BTB never signs or sends: a person signs from a link, or an agent signs with its own wallet.

## Connect

- [MCP server](https://btb.finance/api/mcp): Streamable HTTP, no key. Works in Claude, ChatGPT, Grok, Gemini, Perplexity, Le Chat, Claude Code, Cursor and any MCP client. Claude Code: \`claude mcp add --transport http btb https://btb.finance/api/mcp\`
- [REST API](https://btb.finance/api/v1): the same tools as JSON over HTTP. Any tool by name: \`POST /api/v1/tools/<name>\`. 20 calls a minute per IP without a key, 120 with a free key from \`POST https://btb.finance/api/v1/keys\`.
- [OpenAPI spec](https://btb.finance/api/v1/openapi.json): every endpoint and argument, for SDK generators and function calling.
- [Docs](https://btb.finance/agents/docs): setup per assistant, tool reference, how transactions work, a full example of an agent signing with its own wallet.
- [Playground](https://btb.finance/agents/playground): try any tool in the browser.
- [Protocols](https://btb.finance/agents/protocols): the protocol registry with official contract addresses.

## What to call

- Where to earn on a token: \`compare_yield\` (GET /api/v1/yield?token=USDC&chain=base). Lending, Morpho vaults (with addresses and curators), savings, ETH staking and stable LPs, ranked by base yield with a stability flag.
- Tokens: \`find_token\` (no chain = every chain), \`quote_swap\`, \`quick_token_check\` (free honeypot and tax check), \`token_safety\`.
- Wallets: \`wallet_tokens\`, \`wallet_positions\`, \`tx_status\`.
- Pools: \`top_pools\`, \`search_pools\`, \`best_pools_for\`, \`compare_pools\`, \`pool_details\`, \`lp_plan\`.
- Cross-chain: \`build_bridge\` (sell any token on one chain, receive any token on another, via LI.FI), then \`bridge_status\`.
- Build: \`build_swap\`, \`build_lend\` and \`build_withdraw\` (Aave V3), \`build_zap_liquidity\` (add liquidity from one token), \`build_add_liquidity\`, \`build_tx\` (any contract; \`steps\` for approve plus action in one link).
- Protocols and contracts: \`list_protocols\`, \`get_protocol\`, \`get_abi\`, \`read_contract\`.

## Signing

- Every build answer has numbered steps (exact approvals first, then the action), a dry run, warnings and a \`signLink\`.
- For a person: give them the signLink. It opens btb.finance with the steps to sign in their own wallet (sealed by BTB, valid 15 minutes, only for that wallet). Then call \`sign_status\` with the link to see what they signed, checked on chain.
- For an agent with its own wallet: sign and send \`transactions\` in order, stop on a failed dry run, confirm with \`tx_status\`.

## Notes

- Never write a token or contract address from memory: use find_token, get_protocol or compare_yield.
- Integers in contract calls are in base units. Approvals are always for the exact amount.
- Swaps built by BTB carry a 1% fee on the output, shown in every quote and shared with BTB users every Friday. Reading is free.
- Nothing here is financial advice.
`;

export function GET() {
  return new Response(BODY, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
