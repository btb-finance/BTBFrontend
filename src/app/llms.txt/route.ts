export const dynamic = 'force-static';

// https://btb.finance/llms.txt: where AI agents look first to learn how to use a site.
const BODY = `# BTB Finance

> Live DeFi data and transaction building for agents: liquidity pools with risk grades across Base, Ethereum, BNB Chain, Robinhood Chain and more; token safety; wallet LP positions; a registry of 50 protocols with official contract addresses; any contract's ABI and reads; and unsigned transactions (swaps, LP deposits, any contract call) with dry runs. BTB never signs or sends: your own wallet does.

## Use it

- [MCP server](https://btb.finance/api/mcp): Streamable HTTP, no key. Claude Code: \`claude mcp add --transport http btb https://btb.finance/api/mcp\`
- [REST API](https://btb.finance/api/v1): the same tools as JSON over HTTP. 20 calls a minute per IP without a key, 120 with a free key from \`POST https://btb.finance/api/v1/keys\`.
- [OpenAPI spec](https://btb.finance/api/v1/openapi.json): every endpoint and argument.
- [Docs](https://btb.finance/agents/docs): setup, tool reference, how transactions work, fees.
- [Protocols](https://btb.finance/agents/protocols): the protocol registry.
- [Playground](https://btb.finance/agents/playground): try any tool in the browser.

## Notes

- Integers in contract calls are in base units. Build endpoints return numbered steps: approvals first (exact amounts), then the action; send them in order.
- Swaps built by BTB carry a small fee on the output, shown in every quote. Reading is free.
- Nothing here is financial advice.
`;

export function GET() {
  return new Response(BODY, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
