import { NextRequest } from 'next/server';

const UPSTREAM = 'https://api.krystal.app/all/v1/balance/token';
const CHAIN_IDS = '1,10,56,130,137,146,2020,324,42161,43114,59144,80094,81457,8453,999';
const DEX_CHAIN: Record<number, string> = {
  1: 'ethereum', 10: 'optimism', 56: 'bsc', 130: 'unichain', 137: 'polygon',
  146: 'sonic', 324: 'zksync', 42161: 'arbitrum', 43114: 'avalanche',
  59144: 'linea', 81457: 'blast', 8453: 'base', 999: 'hyperevm',
};

interface KrystalBalance {
  balance?: string;
  token?: { address?: string; tag?: string; decimals?: number };
  quotes?: { usd?: { value?: number; price?: number; marketPrice?: number; timestamp?: number; [key: string]: unknown } };
}

interface KrystalChainBalances {
  chainId?: number;
  balances?: KrystalBalance[];
}

interface DexPair {
  baseToken?: { address?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
}

async function correctStalePrices(data: KrystalChainBalances[]) {
  const jobs: Promise<void>[] = [];
  for (const chain of data) {
    const dexChain = chain.chainId ? DEX_CHAIN[chain.chainId] : undefined;
    if (!dexChain) continue;
    const stale = (chain.balances ?? []).filter((item) => {
      const quote = item.quotes?.usd;
      return !!item.token?.address
        && !item.token.tag?.toUpperCase().includes('SPAM')
        && (quote?.price ?? 0) > 0
        && (quote?.marketPrice ?? 0) <= 0
        && (quote?.timestamp ?? 0) <= 0;
    });

    for (let i = 0; i < stale.length; i += 30) {
      const batch = stale.slice(i, i + 30);
      jobs.push((async () => {
        const addresses = batch.map(item => item.token!.address!.toLowerCase());
        const res = await fetch(`https://api.dexscreener.com/tokens/v1/${dexChain}/${addresses.join(',')}`, {
          cache: 'no-store', signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return;
        const pairs = await res.json() as DexPair[];
        const best = new Map<string, DexPair>();
        for (const pair of pairs) {
          const address = pair.baseToken?.address?.toLowerCase();
          const price = Number(pair.priceUsd ?? 0);
          const liquidity = pair.liquidity?.usd ?? 0;
          if (!address || !Number.isFinite(price) || price <= 0 || liquidity < 10_000) continue;
          if (liquidity > (best.get(address)?.liquidity?.usd ?? 0)) best.set(address, pair);
        }
        for (const item of batch) {
          const address = item.token!.address!.toLowerCase();
          const pair = best.get(address);
          const price = Number(pair?.priceUsd ?? 0);
          if (!pair || price <= 0 || !item.quotes?.usd) continue;
          const decimals = item.token?.decimals ?? 18;
          let balance = 0;
          try { balance = Number(BigInt(item.balance ?? '0')) / 10 ** decimals; } catch { continue; }
          item.quotes.usd.price = price;
          item.quotes.usd.marketPrice = price;
          item.quotes.usd.value = balance * price;
          item.quotes.usd.timestamp = Math.floor(Date.now() / 1000);
          item.quotes.usd.source = 'dexscreener';
        }
      })());
    }
  }
  await Promise.allSettled(jobs);
}

export async function GET(req: NextRequest) {
  const address = new URL(req.url).searchParams.get('address') ?? '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ error: 'invalid address' }, { status: 400 });
  }

  try {
    const query = new URLSearchParams({
      // Krystal's balance endpoint requires this namespaced address form.
      addresses: `ethereum:${address.toLowerCase()}`,
      chainIDs: CHAIN_IDS,
      quoteSymbols: 'usd',
      sparkline: 'false',
    });
    const res = await fetch(`${UPSTREAM}?${query}`, {
      headers: { accept: 'application/json', 'user-agent': 'BTB-Finance/1.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error('upstream error');
    const body = await res.json() as { data?: KrystalChainBalances[] };
    if (!Array.isArray(body?.data)) throw new Error('invalid response');
    await correctStalePrices(body.data);
    return Response.json(body, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'balances unavailable' }, { status: 502 });
  }
}
