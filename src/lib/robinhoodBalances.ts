import { createPublicClient, erc20Abi, formatUnits, http } from 'viem';
import { robinhoodChain } from './wagmi';
import type { Token } from './TokenStore';

type BlockscoutBalance = {
  value?: string;
  token?: {
    address_hash?: string; symbol?: string; name?: string; decimals?: string | number;
    icon_url?: string | null; type?: string; exchange_rate?: string | null; reputation?: string;
  };
};

const client = createPublicClient({ chain: robinhoodChain, transport: http('https://rpc.mainnet.chain.robinhood.com/') });
const WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';

async function ethUsdPrice(): Promise<number> {
  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/robinhood/${WETH}`, { cache: 'no-store' });
    if (!res.ok) return 0;
    const rows = await res.json() as {
      baseToken?: { address?: string }; quoteToken?: { address?: string };
      priceUsd?: string; priceNative?: string; liquidity?: { usd?: number };
    }[];
    // DexScreener's priceUsd belongs to baseToken. When WETH is the quote
    // token (common on Robinhood), derive WETH/USD as baseUsd / basePerWETH.
    const candidates = rows.flatMap((row) => {
      const liquidity = row.liquidity?.usd ?? 0;
      if (liquidity < 10_000) return [];
      const usd = Number(row.priceUsd);
      const native = Number(row.priceNative);
      const wethIsBase = row.baseToken?.address?.toLowerCase() === WETH.toLowerCase();
      const wethIsQuote = row.quoteToken?.address?.toLowerCase() === WETH.toLowerCase();
      const price = wethIsBase ? usd : wethIsQuote && native > 0 ? usd / native : 0;
      return Number.isFinite(price) && price > 100 && price < 100_000 ? [{ price, liquidity }] : [];
    });
    candidates.sort((a, b) => b.liquidity - a.liquidity);
    return candidates[0]?.price ?? 0;
  } catch { return 0; }
}

/** Discover through Blockscout, then verify every balance against chain 4663. */
export async function fetchRobinhoodBalances(owner: string): Promise<Token[]> {
  const res = await fetch(`https://robinhoodchain.blockscout.com/api/v2/addresses/${owner}/token-balances`, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Robinhood balances ${res.status}`);
  const indexed = (await res.json() as BlockscoutBalance[]).filter((row) =>
    row.token?.type === 'ERC-20' && /^0x[0-9a-fA-F]{40}$/.test(row.token.address_hash ?? ''),
  );

  const verified = await client.multicall({
    contracts: indexed.map((row) => ({
      address: row.token!.address_hash as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [owner as `0x${string}`] as const,
    })),
    allowFailure: true,
  });

  const tokens: Token[] = [];
  indexed.forEach((row, index) => {
    const token = row.token!;
    const read = verified[index];
    if (read.status !== 'success' || (read.result as bigint) <= 0n) return;
    const raw = read.result as bigint;
    const decimals = Number(token.decimals ?? 18);
    const balance = formatUnits(raw, Number.isFinite(decimals) ? decimals : 18);
    const price = Number(token.exchange_rate) || 0;
    tokens.push({
      address: token.address_hash!.toLowerCase(),
      symbol: token.symbol || '?', name: token.name || token.symbol || 'Unknown token',
      decimals, logoURI: token.icon_url || undefined,
      balance, balanceRaw: raw.toString(), usdPrice: price,
      usdValue: Number(balance) * price,
      chainId: 4663, chainSlug: 'Robinhood Chain',
      verified: token.reputation === 'ok',
      suspiciousQuote: token.reputation != null && token.reputation !== 'ok',
    });
  });

  const [nativeRaw, nativePrice] = await Promise.all([
    client.getBalance({ address: owner as `0x${string}` }),
    ethUsdPrice(),
  ]);
  if (nativeRaw > 0n) {
    const balance = formatUnits(nativeRaw, 18);
    tokens.push({
      address: 'ETH', symbol: 'ETH', name: 'Ether', decimals: 18,
      balance, balanceRaw: nativeRaw.toString(), usdPrice: nativePrice,
      usdValue: Number(balance) * nativePrice,
      chainId: 4663, chainSlug: 'Robinhood Chain', verified: true,
    });
  }
  return tokens;
}
