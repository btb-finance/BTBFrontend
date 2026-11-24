# BTB MCP server (standalone)

The BTB agent connector as its own container: the same tools as `src/app/api/mcp/route.ts`,
without Next.js and without Netlify's 26-second function limit. It holds no private keys and
no user data, so it can run on untrusted hosts (Flux, Akash, any VPS).

- Endpoints: `/mcp` (and `/api/mcp`, so existing client URLs keep working), `/health`
- Image: `ghcr.io/btb-finance/btb-mcp` built by `.github/workflows/mcp-image.yml`
  (`latest` from main, `<branch>` from other branches, `sha-<commit>` for every build)

## Environment

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | yes | The Convex deployment the pool tools read (public URL, not a secret) |
| `PORT` | no | Defaults to 8080 |
| `BTB_MCP_SWAP_FEE_BPS` | no | Fee on agent-built swaps, 0–1000 bps; defaults to the app's fee |
| `NEXT_PUBLIC_BTB_SWAP_FEE_RECEIVER` | no | Fee receiver; defaults to the app's |
| `KYBER_PROXY_URL` | recommended | `https://btb.finance/api/kyber`: where swap quotes go when KyberSwap refuses the host's IP (HTTP 403) |
| `KYBER_PROXY_SECRET` | with the above | Shared key for that relay; set the same value on Netlify. Keep it in Flux's private (Enterprise) settings |

No signing keys belong in this container. `KYBER_PROXY_SECRET` only unlocks the swap-quote relay.

## Deploy on Flux (cloud.runonflux.com → Deploy → Docker)

1. **Docker image:** `ghcr.io/btb-finance/btb-mcp:latest` (make the GHCR package public once,
   or turn on "This image is private" and enter a GitHub token with `read:packages`).
2. **App name:** e.g. `btbmcp`. **Port:** `8080`.
3. **Environment variables:** `NEXT_PUBLIC_CONVEX_URL=https://grateful-oyster-780.convex.cloud`,
   `KYBER_PROXY_URL=https://btb.finance/api/kyber`, `KYBER_PROXY_SECRET=<same as Netlify>`.
4. **Power:** 1 vCPU, 2 GB RAM, 20 GB disk. **Stores data:** off.
5. **Copies:** 3. **Period:** 1 month to start.
6. Test `https://<app-domain>/health`, then point `mcp.btb.finance` at it through Cloudflare.

## Local

```
docker build -f mcp-server/Dockerfile -t btb-mcp .
docker run -p 8080:8080 -e NEXT_PUBLIC_CONVEX_URL=https://grateful-oyster-780.convex.cloud btb-mcp
```
