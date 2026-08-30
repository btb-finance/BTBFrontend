/**
 * Server-side pool for Robinhood Chain (chain 4663) JSON-RPC reads.
 *
 * The shared Alchemy key blows through its monthly capacity, so every call it
 * serves came back 429. Each endpoint below was verified live: correct chain
 * id, block-synced, and a 25-request parallel burst with zero rejections.
 * Requests round-robin across the pool so the load is shared, and any non-200
 * (or network error) fails over to the next endpoint in line.
 */
export const ROBINHOOD_RPC_UPSTREAMS = [
  'https://rpc.mainnet.chain.robinhood.com/',
  'https://robinhood-rpc.publicnode.com',
  'https://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public',
  'https://rpc-robinhood.blockmachine.io',
  'https://robinhood.api.pocket.network',
  'https://robinhood.rpc.blxrbdn.com',
] as const;

// Each process starts at a random offset so serverless instances don't all
// stampede the same first endpoint, then walks the ring from there.
let cursor = Math.floor(Math.random() * ROBINHOOD_RPC_UPSTREAMS.length);

export async function robinhoodRpcFetch(body: string, timeoutMs = 20_000): Promise<Response> {
  const start = cursor;
  cursor = (cursor + 1) % ROBINHOOD_RPC_UPSTREAMS.length;

  let lastError: unknown = new Error('no Robinhood RPC upstream attempted');
  for (let offset = 0; offset < ROBINHOOD_RPC_UPSTREAMS.length; offset++) {
    const url = ROBINHOOD_RPC_UPSTREAMS[(start + offset) % ROBINHOOD_RPC_UPSTREAMS.length];
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return response;
      lastError = new Error(`${url} → rpc ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
