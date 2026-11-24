# Protocol registry format

One JSON file per protocol: `registry/protocols/<slug>.json` (slug = DefiLlama's, e.g. `lido`, `maple-finance`).
The MCP serves these to agents (`list_protocols`, `get_protocol`), and agents fetch full ABIs with `get_abi`.
**Accuracy rule: every address must come from an official source (protocol docs, official GitHub deployments
file, or the issuer's own page), with that URL in `source`. Never guess or copy an address from a random site.
Leave a contract out rather than include one you could not confirm.**

```json
{
  "slug": "lido",
  "name": "Lido",
  "category": "Liquid Staking",
  "description": "One or two sentences: what an agent can do with it.",
  "website": "https://lido.fi",
  "docs": "https://docs.lido.fi",
  "defillama": "https://defillama.com/protocol/lido",
  "chains": ["ethereum", "base"],
  "vm": "evm",                       // "evm" | "solana" | "ton" | "hyperliquid-l1" | "mixed"
  "agentAccess": "onchain",          // "onchain" | "api" | "both": how an agent actually uses it
  "contracts": [
    {
      "chain": "ethereum",           // lower-case chain name
      "chainId": 1,                  // null for non-EVM
      "address": "0x…",              // checksummed for EVM; native format otherwise
      "name": "stETH",
      "role": "token | pool | router | vault | factory | bridge | exchange | staking | governance | other",
      "proxy": true,                 // true / false / null if unknown
      "source": "https://docs.lido.fi/deployed-contracts/",
      "keyFunctions": [
        {
          "signature": "submit(address)",
          "kind": "write",           // "read" | "write"
          "payable": true,
          "description": "Stake ETH, receive stETH. Argument: referral address (zero address if none)."
        }
      ]
    }
  ],
  "offchainApis": [
    { "name": "Withdrawal API", "url": "https://…", "auth": "none | api-key | signature", "use": "what an agent uses it for", "source": "https://…" }
  ],
  "actions": [
    { "name": "stake", "description": "Stake ETH for stETH", "how": "contract stETH.submit(referral) with ETH value" }
  ],
  "risks": ["Short, factual notes an agent should know: e.g. withdrawals take days; token is rebasing; issuer can freeze addresses."],
  "notes": "Anything else, e.g. which chains are bridged versions.",
  "sources": ["every URL you used"],
  "researchedAt": "2026-11-24"
}
```

Keep `keyFunctions` to what an agent would actually call (5–15 per main contract), not the whole ABI.
For token issuers (Tether, Circle) list the token contract on each chain they officially support, plus their
own protocol contracts (e.g. Circle CCTP). For protocols with dozens of chains (Uniswap), cover the main
contracts on the major chains from the official deployments page and say in `notes` where the full list lives.
