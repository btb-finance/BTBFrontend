// Mobula API — wallet portfolio + DeFi positions

const MOBULA_KEY = '9cd29c60-b3a7-45e2-a06f-3e730e06e76f';
const HEADERS = { Authorization: MOBULA_KEY, accept: 'application/json' };

// ─── Portfolio ────────────────────────────────────────────────────────────────

export interface MobulaAsset {
  address: string;   // token contract (lowercase) or 'ETH' for native
  symbol: string;
  name: string;
  decimals: number;
  balance: number;       // token amount
  balanceUSD: number;    // USD value
  price: number;
  priceChange24h?: number;
  logoURI?: string;
  chainId: number;
}

export async function fetchMobulaPortfolio(wallet: string): Promise<{ assets: MobulaAsset[]; totalUSD: number }> {
  const res = await fetch(
    `https://api.mobula.io/api/1/wallet/portfolio?wallet=${wallet}`,
    { headers: HEADERS },
  );
  if (!res.ok) throw new Error(`Mobula portfolio ${res.status}`);
  const json = await res.json();
  const data = json?.data ?? {};
  const totalUSD: number = data.total_wallet_balance ?? 0;

  const assets: MobulaAsset[] = (data.assets ?? []).map((a: any) => {
    const asset = a.asset ?? {};
    const contracts: string[] = asset.contracts ?? [];
    const rawAddr = contracts.find((c: string) => c?.startsWith('0x')) ?? '';
    const address = rawAddr ? rawAddr.toLowerCase() : 'ETH';

    // cross_chain_balances is a map of chainName → { balance, chainId (string!), address }
    const chainBreakdown: any[] = a.cross_chain_balances
      ? Object.values(a.cross_chain_balances)
      : [];
    const topChain = chainBreakdown.sort((x: any, y: any) => (y.balance ?? 0) - (x.balance ?? 0))[0];
    // chainId comes as a string '1', parse to number
    const chainId: number = topChain?.chainId != null ? parseInt(topChain.chainId, 10) : 1;

    const tokenBalance: number = a.token_balance ?? 0;
    const price: number = a.price ?? 0;
    // estimated_balance is NOT USD — compute USD as balance × price
    const balanceUSD = tokenBalance * price;

    return {
      address,
      symbol:        asset.symbol ?? '?',
      name:          asset.name   ?? asset.symbol ?? '?',
      decimals:      asset.decimals ?? 18,
      balance:       tokenBalance,
      balanceUSD,
      price,
      priceChange24h: a.price_change_24h,
      logoURI:       asset.logo,
      chainId,
    } satisfies MobulaAsset;
  });

  return { assets, totalUSD };
}

// ─── DeFi positions ───────────────────────────────────────────────────────────

export interface MobulaDefiToken {
  symbol: string;
  address: string;
  amountFormatted: number;
  priceUSD: number;
  valueUSD: number;
  metaType?: string; // 'supplied' | 'borrowed' | 'reward' etc
}

export interface MobulaDefiPosition {
  type: string;       // 'liquidity' | 'lending' | 'staking' | 'farming' etc
  label: string;
  groupLabel?: string;
  valueUSD: number;
  tokens: MobulaDefiToken[];
}

export interface MobulaDefiApp {
  name: string;
  imgUrl?: string;
  category?: string;
  balanceUSD: number;
  positions: MobulaDefiPosition[];
}

export async function fetchMobulaDefi(wallet: string): Promise<{ apps: MobulaDefiApp[]; totalUSD: number }> {
  const res = await fetch(
    `https://api.mobula.io/api/1/wallet/defi-positions?wallet=${wallet}`,
    { headers: HEADERS },
  );
  if (!res.ok) throw new Error(`Mobula DeFi ${res.status}`);
  const json = await res.json();
  // data is an array of { protocol, positions[] }
  const entries: any[] = Array.isArray(json?.data) ? json.data : [];

  let totalUSD = 0;

  const apps: MobulaDefiApp[] = entries.map((entry: any) => {
    const proto = entry.protocol ?? {};

    const positions: MobulaDefiPosition[] = (entry.positions ?? []).map((pos: any) => {
      const tokens: MobulaDefiToken[] = (pos.tokens ?? []).map((t: any) => ({
        symbol:          t.symbol ?? '?',
        address:         (t.contract ?? '').toLowerCase(),
        amountFormatted: parseFloat(t.amount ?? '0'),
        priceUSD:        parseFloat(t.price_usd ?? '0') || 0,
        valueUSD:        parseFloat(t.amount_usd ?? '0') || 0,
      }));

      // position value: sum of token USD amounts, or LP reserve_usd if available
      const posValueUSD = pos.extra?.reserve_usd != null
        ? (pos.extra.reserve_usd as number)
        : tokens.reduce((s, t) => s + t.valueUSD, 0);

      return {
        type:       pos.type ?? 'position',
        label:      pos.name ?? pos.type ?? '',
        groupLabel: pos.type,
        valueUSD:   posValueUSD,
        tokens,
      } satisfies MobulaDefiPosition;
    });

    const appValueUSD = positions.reduce((s, p) => s + p.valueUSD, 0);
    totalUSD += appValueUSD;

    return {
      name:       proto.name ?? proto.id ?? 'Unknown',
      imgUrl:     proto.logo,
      category:   proto.category,
      balanceUSD: appValueUSD,
      positions,
    } satisfies MobulaDefiApp;
  }).filter(app => app.balanceUSD > 0.01);

  return { apps, totalUSD };
}
