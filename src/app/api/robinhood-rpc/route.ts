export const maxDuration = 25;
export const dynamic = 'force-dynamic';

const RPC_URL = `https://robinhood-mainnet.g.alchemy.com/v2/${
  process.env.ALCHEMY_KEY
  ?? process.env.NEXT_PUBLIC_ALCHEMY_KEY
  ?? 'INhvk7-hUrgf5niZBGbae'
}`;

// Keep this a read-only, chain-pinned proxy. Wallet writes still go through the
// connected wallet provider; this endpoint only makes portfolio reads reliable
// on hosted builds where public RPC CORS/rate limits can differ from localhost.
const READ_METHODS = new Set([
  'eth_blockNumber',
  'eth_call',
  'eth_chainId',
  'eth_estimateGas',
  'eth_feeHistory',
  'eth_gasPrice',
  'eth_getBalance',
  'eth_getBlockByHash',
  'eth_getBlockByNumber',
  'eth_getBlockReceipts',
  'eth_getCode',
  'eth_getLogs',
  'eth_getStorageAt',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_maxPriorityFeePerGas',
  'net_version',
]);

type RpcCall = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };

function validCall(value: unknown): value is RpcCall {
  if (!value || typeof value !== 'object') return false;
  const call = value as RpcCall;
  return call.jsonrpc === '2.0' && typeof call.method === 'string' && READ_METHODS.has(call.method);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON-RPC body' }, { status: 400 });
  }

  const calls = Array.isArray(body) ? body : [body];
  if (calls.length === 0 || calls.length > 100 || !calls.every(validCall)) {
    return Response.json({ error: 'unsupported JSON-RPC request' }, { status: 400 });
  }

  try {
    const upstream = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return Response.json({ error: 'Robinhood RPC unavailable' }, { status: 502 });
  }
}
