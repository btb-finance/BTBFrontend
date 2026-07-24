export const maxDuration = 25;

import { NextRequest } from 'next/server';

const UPSTREAM = 'https://api.krystal.app/all/v1/lp/userPositions';
// Networks currently advertised by Krystal's public LP config. This endpoint
// is read-only; unsupported/empty chains simply return no positions.
const CHAIN_IDS = '1,10,56,130,137,146,2020,324,42161,43114,59144,80094,81457,8453,999';

/** Read-only Krystal LP analytics proxy. The address is the only caller input;
 * chain, pagination and endpoint are pinned so this cannot become an open proxy. */
export async function GET(req: NextRequest) {
  const address = new URL(req.url).searchParams.get('address') ?? '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ error: 'invalid address' }, { status: 400 });
  }

  try {
    const loadPage = async (positionStatus: 'open' | 'closed', offset: number) => {
      const query = new URLSearchParams({
        addresses: address, chainIds: CHAIN_IDS, positionStatus,
        orderBy: 'lastAction', orderASC: 'false', limit: '100', offset: String(offset),
      });
      const res = await fetch(`${UPSTREAM}?${query}`, {
        headers: { accept: 'application/json', 'user-agent': 'BTB-Finance/1.0' },
        cache: 'no-store', signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error('upstream error');
      return res.json() as Promise<{ positions?: Record<string, unknown>[]; statsByChain?: Record<string, unknown> }>;
    };
    const settled = await Promise.allSettled([
      loadPage('open', 0), loadPage('closed', 0), loadPage('closed', 100), loadPage('closed', 200),
    ]);
    const pages = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
    if (pages.length === 0) return Response.json({ error: 'analytics unavailable' }, { status: 502 });
    const seen = new Set<string>();
    const positions = pages.flatMap((page) => page.positions ?? []).filter((position) => {
      const key = `${position.chainId ?? ''}:${position.tokenAddress ?? ''}:${position.tokenId ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return Response.json({ statsByChain: pages[0]?.statsByChain ?? {}, positions }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'analytics unavailable' }, { status: 502 });
  }
}
