import { KYBER_CHAINS } from '@/lib/kyberswap';

type LifiToken = {
  address?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  chainId?: number;
  logoURI?: string;
  priceUSD?: string;
  verificationStatus?: 'verified' | 'unverified' | 'flagged';
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const TOKEN_CATALOG_VARY = { 'Netlify-Vary': 'query=chainId' };

export async function GET(request: Request) {
  const chainId = Number(new URL(request.url).searchParams.get('chainId'));
  if (!Number.isInteger(chainId) || !KYBER_CHAINS[chainId]) {
    return Response.json(
      { error: 'Unsupported swap network', tokens: [] },
      { status: 400, headers: TOKEN_CATALOG_VARY },
    );
  }

  try {
    const response = await fetch(`https://li.quest/v1/tokens?chains=${chainId}`, {
      next: { revalidate: 3_600 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Token catalog ${response.status}`);
    const body = await response.json() as { tokens?: Record<string, LifiToken[]> };
    const seen = new Set<string>();
    const tokens = (body.tokens?.[String(chainId)] ?? []).flatMap(token => {
      const address = token.address?.toLowerCase();
      if (!address || !token.symbol || !Number.isInteger(token.decimals) || token.verificationStatus === 'flagged') return [];
      const normalizedAddress = address === ZERO_ADDRESS ? 'ETH' : address;
      if (seen.has(normalizedAddress)) return [];
      seen.add(normalizedAddress);
      const price = Number(token.priceUSD ?? 0);
      return [{
        address: normalizedAddress,
        symbol: token.symbol,
        name: token.name || token.symbol,
        decimals: token.decimals!,
        chainId,
        logoURI: token.logoURI,
        usdPrice: Number.isFinite(price) && price > 0 ? price : undefined,
        verified: token.verificationStatus === 'verified',
      }];
    });
    return Response.json({ tokens }, {
      headers: {
        ...TOKEN_CATALOG_VARY,
        'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return Response.json(
      { error: 'Token catalog unavailable', tokens: [] },
      { status: 502, headers: TOKEN_CATALOG_VARY },
    );
  }
}
