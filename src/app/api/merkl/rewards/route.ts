export const maxDuration = 20;

import { NextRequest } from 'next/server';
import { MERKL_CHAINS } from '@/lib/merkl';

/** Read-only Merkl rewards proxy. Merkl's API does not send CORS headers to
 * every origin (localhost gets none), so the browser reads through here.
 * Address and chain are the only inputs, both validated; the upstream path is
 * pinned so this cannot become an open proxy. */
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const address = params.get('address') ?? '';
  const chainId = Number(params.get('chainId'));
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return Response.json({ error: 'invalid address' }, { status: 400 });
  if (!MERKL_CHAINS.has(chainId)) return Response.json({ error: 'unsupported chain' }, { status: 400 });
  try {
    const res = await fetch(`https://api.merkl.xyz/v4/users/${address}/rewards?chainId=${chainId}`, {
      headers: { accept: 'application/json', 'user-agent': 'BTB-Finance/1.0' },
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return Response.json({ error: 'rewards unavailable' }, { status: 502 });
    return Response.json(await res.json(), { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'rewards unavailable' }, { status: 502 });
  }
}
