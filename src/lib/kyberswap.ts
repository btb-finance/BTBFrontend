// KyberSwap chain slug per chainId
export const KYBER_CHAINS: Record<number, string> = {
  1:     'ethereum',
  56:    'bsc',
  137:   'polygon',
  42161: 'arbitrum',
  10:    'optimism',
  8453:  'base',
  43114: 'avalanche',
  59144: 'linea',
  80094: 'berachain',
  146:   'sonic',
  2020:  'ronin',
  130:   'unichain',
  999:   'hyperevm',
  9745:  'plasma',
  42793: 'etherlink',
  143:   'monad',
  4326:  'megaeth',
  4663:  'robinhood',
};

export const BTB_SWAP_FEE_BPS = 100;
export const BTB_SWAP_FEE_PERCENT = BTB_SWAP_FEE_BPS / 100;
const BTB_SWAP_FEE_RECEIVER = process.env.NEXT_PUBLIC_BTB_SWAP_FEE_RECEIVER
  ?? '0xfed2Ff614E0289D41937139730B49Ee158D02299';

function base(chainId: number) {
  const slug = KYBER_CHAINS[chainId];
  if (!slug) throw new Error(`KyberSwap is not configured for chain ${chainId}`);
  return `https://aggregator-api.kyberswap.com/${slug}/api/v1`;
}

export interface KyberQuote {
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd: number;
  rate: number;
  priceImpact: number;
  gasUsd: number;
  route: string;
  routeSummary: any;
  routerAddress: string;
}

export async function getKyberQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  decimalsOut: number,
  chainId = 1,
  options: { chargeBtbFee?: boolean; decimalsIn?: number } = {},
): Promise<KyberQuote> {
  const nativeAddr = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const inAddr  = tokenIn  === 'ETH' ? nativeAddr : tokenIn;
  const outAddr = tokenOut === 'ETH' ? nativeAddr : tokenOut;

  const params = new URLSearchParams({ tokenIn: inAddr, tokenOut: outAddr, amountIn, saveGas: '0', gasInclude: '1' });
  if (options.chargeBtbFee) {
    params.set('chargeFeeBy', 'currency_out');
    params.set('isInBps', 'true');
    params.set('feeAmount', String(BTB_SWAP_FEE_BPS));
    params.set('feeReceiver', BTB_SWAP_FEE_RECEIVER);
  }
  const url = `${base(chainId)}/routes?${params.toString()}`;
  const res = await fetch(url, { headers: { 'x-client-id': 'btb-finance' } });
  if (!res.ok) throw new Error(`KyberSwap routes ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message ?? 'KyberSwap error');

  const rs = json.data?.routeSummary;
  const amountOut = rs?.amountOut ?? '0';
  const amountOutNum = parseInt(amountOut) / Math.pow(10, decimalsOut);

  const paths: string[] = [];
  for (const route of (rs?.route ?? [])) {
    for (const pool of (route ?? [])) {
      if (pool.exchange && !paths.includes(pool.exchange)) paths.push(pool.exchange);
    }
  }

  return {
    amountOut,
    amountOutFormatted: amountOutNum.toLocaleString('en-US', { maximumFractionDigits: 6 }),
    amountOutUsd:  parseFloat(rs?.amountOutUsd ?? '0'),
    rate:          parseFloat(rs?.amountInUsd ?? '1') > 0
                   ? amountOutNum / (parseInt(rs?.amountIn ?? '1') / Math.pow(10, options.decimalsIn ?? 18))
                   : 0,
    priceImpact:   parseFloat(rs?.priceImpact ?? '0'),
    gasUsd:        parseFloat(rs?.gasUsd ?? '0'),
    route:         paths.slice(0, 3).join(' · ') || 'KyberSwap',
    routeSummary:  rs,
    routerAddress: json.data?.routerAddress ?? '',
  };
}

export async function buildKyberTx(
  routeSummary: any,
  routerAddress: string,
  sender: string,
  recipient: string,
  slippageBps = 50,
  chainId = 1,
) {
  const res = await fetch(`${base(chainId)}/route/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-client-id': 'btb-finance' },
    body: JSON.stringify({ routeSummary, sender, recipient, slippageTolerance: slippageBps }),
  });
  if (!res.ok) throw new Error(`KyberSwap build ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message ?? 'Build error');
  const d = json.data;
  return {
    data:  d.data,
    to:    (d.routerAddress ?? routerAddress) as `0x${string}`,
    value: d.value ?? '0',
    gas:   d.gas,
  };
}
