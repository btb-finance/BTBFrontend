const ZAPPER_URL = 'https://public.zapper.xyz/graphql';
const API_KEY    = process.env.NEXT_PUBLIC_ZAPPER_KEY ?? '';
const MAINNET_CHAIN_ID = 1;

async function gql(query: string, variables: Record<string, unknown>) {
  const res = await fetch(ZAPPER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-zapper-api-key': API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Zapper ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

// ─── DeFi positions (mainnet only) ───────────────────────────────────────────

const DEFI_QUERY = `
query AppBalances($addresses: [Address!]!, $first: Int = 25) {
  portfolioV2(addresses: $addresses) {
    appBalances {
      totalBalanceUSD
      byApp(first: $first) {
        edges {
          node {
            balanceUSD
            app { displayName imgUrl description category { name } }
            network { name chainId }
            positionBalances(first: 20) {
              edges {
                node {
                  ... on AppTokenPositionBalance {
                    type symbol balance balanceUSD price groupLabel
                    displayProps { label images }
                  }
                  ... on ContractPositionBalance {
                    type balanceUSD groupLabel
                    tokens {
                      metaType
                      token {
                        ... on BaseTokenPositionBalance { symbol balance balanceUSD }
                      }
                    }
                    displayProps { label images }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

export interface ZapperApp {
  name: string;
  imgUrl?: string;
  category?: string;
  balanceUSD: number;
  positions: ZapperPosition[];
}

export interface ZapperPosition {
  type: string;
  label: string;
  groupLabel?: string;
  balanceUSD: number;
  symbol?: string;
  balance?: number;
  price?: number;
  tokens?: { metaType: string; symbol: string; balance: number; balanceUSD: number }[];
  images?: string[];
}

export async function fetchZapperDefi(address: string): Promise<{ apps: ZapperApp[]; totalUSD: number }> {
  const data = await gql(DEFI_QUERY, { addresses: [address], first: 25 });
  const ab = data?.portfolioV2?.appBalances;
  const totalUSD: number = ab?.totalBalanceUSD ?? 0;

  const apps: ZapperApp[] = (ab?.byApp?.edges ?? [])
    .map((e: any) => e.node)
    // mainnet only
    .filter((n: any) => n.network?.chainId === MAINNET_CHAIN_ID)
    .map((n: any) => ({
      name:      n.app?.displayName ?? 'Unknown',
      imgUrl:    n.app?.imgUrl,
      category:  n.app?.category?.name,
      balanceUSD: n.balanceUSD ?? 0,
      positions: (n.positionBalances?.edges ?? []).map((pe: any) => {
        const p = pe.node;
        if (p.type === 'app-token') {
          return {
            type:       'app-token',
            label:      p.displayProps?.label ?? p.symbol ?? '',
            groupLabel: p.groupLabel,
            symbol:     p.symbol,
            balance:    p.balance,
            price:      p.price,
            balanceUSD: p.balanceUSD ?? 0,
            images:     p.displayProps?.images ?? [],
          } as ZapperPosition;
        }
        // contract-position
        return {
          type:       'contract',
          label:      p.displayProps?.label ?? '',
          groupLabel: p.groupLabel,
          balanceUSD: p.balanceUSD ?? 0,
          images:     p.displayProps?.images ?? [],
          tokens: (p.tokens ?? []).map((t: any) => ({
            metaType:   t.metaType,
            symbol:     t.token?.symbol ?? '',
            balance:    t.token?.balance ?? 0,
            balanceUSD: t.token?.balanceUSD ?? 0,
          })),
        } as ZapperPosition;
      }),
    }));

  return { apps, totalUSD };
}

// ─── NFT balances (mainnet only) ─────────────────────────────────────────────

const NFT_QUERY = `
query NFTBalances($addresses: [Address!]!, $first: Int) {
  portfolioV2(addresses: $addresses) {
    nftBalances {
      totalBalanceUSD
      totalTokensOwned
      byToken(first: $first) {
        edges {
          node {
            lastReceived
            token {
              tokenId name description
              estimatedValue { valueUsd valueWithDenomination denomination { symbol network } }
              collection {
                network address name type deployer
                medias { logo { mimeType originalUri thumbnail predominantColor } }
              }
              mediasV3 {
                images { edges { node { mimeType originalUri thumbnail predominantColor } } }
              }
            }
          }
        }
      }
    }
  }
}`;

export interface ZapperNFT {
  tokenId: string;
  name: string;
  description?: string;
  image?: string;
  thumbnail?: string;
  color?: string;
  collection: string;
  network: string;
  valueUsd: number;
  valueDenom?: string;
  valueSymbol?: string;
  lastReceived?: string;
}

export async function fetchZapperNFTs(address: string, limit = 25): Promise<{ nfts: ZapperNFT[]; totalUSD: number; totalOwned: number }> {
  const data = await gql(NFT_QUERY, { addresses: [address], first: limit });
  const nb = data?.portfolioV2?.nftBalances;
  const totalUSD: number   = nb?.totalBalanceUSD ?? 0;
  const totalOwned: number = nb?.totalTokensOwned ?? 0;

  const nfts: ZapperNFT[] = (nb?.byToken?.edges ?? [])
    .map((e: any) => e.node)
    // mainnet only
    .filter((n: any) => n.token?.collection?.network === 'ethereum')
    .map((n: any) => {
      const t   = n.token;
      const img = t.mediasV3?.images?.edges?.[0]?.node;
      return {
        tokenId:      t.tokenId,
        name:         t.name ?? `#${t.tokenId}`,
        description:  t.description,
        image:        img?.originalUri,
        thumbnail:    img?.thumbnail,
        color:        img?.predominantColor,
        collection:   t.collection?.name ?? 'Unknown',
        network:      t.collection?.network ?? 'ethereum',
        valueUsd:     t.estimatedValue?.valueUsd ?? 0,
        valueDenom:   t.estimatedValue?.valueWithDenomination,
        valueSymbol:  t.estimatedValue?.denomination?.symbol,
        lastReceived: n.lastReceived,
      } as ZapperNFT;
    });

  return { nfts, totalUSD, totalOwned };
}

// ─── Portfolio chart ──────────────────────────────────────────────────────────

const CHART_QUERY = `
query HistoricalPortfolio($address: Address!, $chainId: Int!, $timeFrame: TimeFrame!) {
  historicalPortfolio(address: $address, chainId: $chainId, timeFrame: $timeFrame) {
    timestamp
    value
  }
}`;

export type TimeFrame = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export interface ChartPoint { timestamp: number; value: number; }

export async function fetchPortfolioChart(address: string, timeFrame: TimeFrame = 'WEEK'): Promise<ChartPoint[]> {
  const data = await gql(CHART_QUERY, { address, chainId: 1, timeFrame });
  return (data?.historicalPortfolio ?? []) as ChartPoint[];
}

// ─── Transaction history ──────────────────────────────────────────────────────

const TX_QUERY = `
query TransactionHistoryV2($subjects: [Address!]!, $first: Int, $after: String) {
  transactionHistoryV2(subjects: $subjects, first: $first, after: $after, filters: { chainIds: [1] }) {
    edges {
      cursor
      node {
        ... on TimelineEventV2 {
          hash
          timestamp
          interpretation { processedDescription }
          transaction {
            fromUser { address }
            toUser   { address }
          }
          deltas {
            edges {
              node {
                tokenDeltasV2 {
                  edges {
                    node {
                      amount
                      token {
                        symbol
                        imageUrlV2
                        priceData { price }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    pageInfo { endCursor hasNextPage }
  }
}`;

export interface ZapperTx {
  hash: string;
  timestamp: number;
  description: string;
  deltas: { amount: number; symbol: string; imageUrl?: string; price?: number }[];
  from: string;
  to: string;
}

export async function fetchTransactionHistory(address: string, first = 25, after?: string): Promise<{ txs: ZapperTx[]; endCursor?: string; hasNextPage: boolean }> {
  const data = await gql(TX_QUERY, { subjects: [address], first, ...(after ? { after } : {}) });
  const history = data?.transactionHistoryV2;
  const txs: ZapperTx[] = (history?.edges ?? [])
    .map((e: any) => e.node)
    .filter((n: any) => n?.hash)          // skip empty union variants
    .map((n: any) => {
      // flatten all tokenDeltasV2 from all delta nodes
      const deltas: ZapperTx['deltas'] = [];
      for (const deltaEdge of (n.deltas?.edges ?? [])) {
        for (const tdEdge of (deltaEdge.node?.tokenDeltasV2?.edges ?? [])) {
          const td = tdEdge.node;
          deltas.push({
            amount:   td.amount ?? 0,
            symbol:   td.token?.symbol ?? '?',
            imageUrl: td.token?.imageUrlV2,
            price:    td.token?.priceData?.price,
          });
        }
      }
      return {
        hash:        n.hash,
        timestamp:   Math.floor((n.timestamp ?? 0) / 1000), // Zapper returns ms
        description: n.interpretation?.processedDescription ?? '—',
        deltas,
        from: n.transaction?.fromUser?.address ?? '',
        to:   n.transaction?.toUser?.address   ?? '',
      };
    });
  return {
    txs,
    endCursor:   history?.pageInfo?.endCursor,
    hasNextPage: history?.pageInfo?.hasNextPage ?? false,
  };
}

// ─── Token price ──────────────────────────────────────────────────────────────

const PRICE_QUERY = `
query TokenPriceData($address: Address!, $chainId: Int!) {
  fungibleTokenV2(address: $address, chainId: $chainId) {
    address symbol name decimals imageUrlV2
    priceData {
      marketCap price priceChange5m priceChange1h priceChange24h
      volume24h totalGasTokenLiquidity totalLiquidity
    }
  }
}`;

export interface ZapperTokenPrice {
  symbol: string;
  name: string;
  imageUrl?: string;
  price: number;
  priceChange24h?: number;
  priceChange1h?: number;
  marketCap?: number;
  volume24h?: number;
  liquidity?: number;
}

export async function fetchZapperTokenPrice(tokenAddress: string): Promise<ZapperTokenPrice | null> {
  const data = await gql(PRICE_QUERY, { address: tokenAddress, chainId: MAINNET_CHAIN_ID });
  const t = data?.fungibleTokenV2;
  if (!t) return null;
  return {
    symbol:        t.symbol,
    name:          t.name,
    imageUrl:      t.imageUrlV2,
    price:         t.priceData?.price ?? 0,
    priceChange24h: t.priceData?.priceChange24h,
    priceChange1h:  t.priceData?.priceChange1h,
    marketCap:     t.priceData?.marketCap,
    volume24h:     t.priceData?.volume24h,
    liquidity:     t.priceData?.totalLiquidity,
  };
}
