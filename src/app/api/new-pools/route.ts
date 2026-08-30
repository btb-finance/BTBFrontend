export const maxDuration = 25;

import { decodeAbiParameters, encodeFunctionData, erc20Abi, getAddress, isAddress } from 'viem';
import { ROBINHOOD_UNISWAP_V3_DEPLOYMENT } from '@/protocols/dexs/uniswap/v3/addresses';
import { aggregate3 } from '@/lib/robinhoodMulticall';

/**
 * Live launch feed for Robinhood Chain.
 *
 * DexScreener and GeckoTerminal only list a pool once it clears their
 * liquidity/activity thresholds, so a token that launched seconds ago is
 * invisible there — measurably so: of six pools created in one 16 second
 * window, DexScreener had indexed two of them and never picked up the rest.
 * This route reads `PoolCreated` off the Uniswap V3 factory instead, which is
 * true the moment the block lands, and prices each token from the pool's own
 * slot0 rather than from any vendor.
 */

const EXPLORER = 'https://robinhoodchain.blockscout.com/api/v2';
const FACTORY = ROBINHOOD_UNISWAP_V3_DEPLOYMENT.factory;
const POSITION_MANAGER = ROBINHOOD_UNISWAP_V3_DEPLOYMENT.positionManager;
const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73';
// PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)
const POOL_CREATED = '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118';
// Almost every launch on this chain goes through the Pons launchpad, which
// mints the LP position and hands it to its locker in the same transaction.
// TokenLaunched carries the facts a buyer actually needs — who deployed it, how
// much the deployer bought for themselves, and which position holds the
// liquidity — so the feed reads it alongside the raw factory. A pool with no
// TokenLaunched behind it was created by hand and nothing is locked.
const LAUNCHPAD = '0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB';
const LAUNCH_LOCKER = '0x736D76699C26D0d966744cAe304C000d471f7F35';
const TOKEN_LAUNCHED = '0xdb51ea9ad51ab453a65a4cb7e60c3cb378c9501bb002609f8f97778fb6c4235a';
// The feed is per-request fresh; Netlify's edge keys route handlers on the path
// alone unless the query is declared here.
const FEED_VARY = { 'Netlify-Vary': 'query=limit|before' };

const SLOT0_SELECTOR = '0x3850c7bd';
const OWNER_OF_SELECTOR = '0x6352211e';
const Q96 = 2 ** 96;

type ExplorerLog = {
  block_number?: number;
  block_timestamp?: string;
  transaction_hash?: string;
  topics?: (string | null)[];
  data?: string;
  decoded?: { method_call?: string; parameters?: { name?: string; value?: string }[] } | null;
};

type Launch = {
  deployer: string;
  positionId: string;
  devBuyWeth: number;
  restrictionsEndBlock: number;
};

export type NewPool = {
  pool: string;
  token: string;
  symbol: string;
  name: string;
  decimals: number;
  fee: number;
  block: number;
  createdAt: string | null;
  ageSeconds: number | null;
  priceUsd: number;
  priceWeth: number;
  liquidityUsd: number;
  wethLiquidity: number;
  transactionHash: string | null;
  tokenIsToken0: boolean;
  // Reads against a pool minted seconds ago can outrun the RPC node, which is a
  // "not known yet", not a "this token is broken" — the caller shows it as
  // still confirming and the next poll fills it in.
  resolved: boolean;
  launchpad: boolean;
  deployer: string | null;
  lpLocked: boolean | null;
  lpOwner: string | null;
  devBuyWeth: number;
  devBuyUsd: number;
  restrictionsEndBlock: number | null;
};

type Read = { key: string; target: string; callData: string };

function decodeString(hex?: string): string | null {
  if (!hex || hex === '0x') return null;
  try { return decodeAbiParameters([{ type: 'string' }], hex as `0x${string}`)[0]; }
  catch {
    // Older tokens return a fixed bytes32 name/symbol rather than a string.
    try {
      const raw = decodeAbiParameters([{ type: 'bytes32' }], hex as `0x${string}`)[0] as `0x${string}`;
      const text = Buffer.from(raw.slice(2), 'hex').toString('utf8').replace(/\0+$/, '');
      return text.trim() || null;
    } catch { return null; }
  }
}

function decodeNumber(hex?: string): number | null {
  if (!hex || hex === '0x') return null;
  try { return Number(BigInt(hex.slice(0, 66))); } catch { return null; }
}

function decodeBigInt(hex?: string): bigint | null {
  if (!hex || hex === '0x') return null;
  try { return BigInt(hex.slice(0, 66)); } catch { return null; }
}

/** Spot price of the new token in WETH, straight from the pool's own slot0. */
function priceFromSlot0(sqrtPriceX96: bigint, tokenIsToken0: boolean, tokenDecimals: number): number {
  if (sqrtPriceX96 <= 0n) return 0;
  // Scale before Number() so a small sqrt price does not underflow to zero.
  const ratio = (Number(sqrtPriceX96) / Q96) ** 2;
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  const decimalShift = 10 ** (tokenDecimals - 18);
  // token0 priced in token1, adjusted for the decimal gap between the two.
  const token0InToken1 = ratio * decimalShift;
  const price = tokenIsToken0 ? token0InToken1 : (token0InToken1 > 0 ? 1 / token0InToken1 : 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

/**
 * WETH in USD. Deliberately not DexScreener: `/tokens/v1/robinhood/{WETH}`
 * returns pairs where WETH is the *quote* side, so its `priceUsd` is the other
 * token's price — reading it gives $0.0006 for ETH. Blockscout quotes the coin
 * directly.
 */
async function wethUsdPrice(): Promise<number> {
  try {
    const response = await fetch(`${EXPLORER}/stats`, { next: { revalidate: 30 }, signal: AbortSignal.timeout(6_000) });
    if (!response.ok) return 0;
    const stats = await response.json() as { coin_price?: string };
    return Number(stats.coin_price ?? 0) || 0;
  } catch { return 0; }
}

/** Recent launchpad launches, keyed by the pool they created. */
async function recentLaunches(): Promise<Map<string, Launch>> {
  const launches = new Map<string, Launch>();
  try {
    const response = await fetch(`${EXPLORER}/addresses/${LAUNCHPAD}/logs`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return launches;
    const body = await response.json() as { items?: ExplorerLog[] };
    for (const item of body.items ?? []) {
      if ((item.topics?.[0] ?? '').toLowerCase() !== TOKEN_LAUNCHED) continue;
      const fields = new Map((item.decoded?.parameters ?? []).map(parameter => [parameter.name ?? '', parameter.value ?? '']));
      const pool = fields.get('pool');
      if (!pool || !isAddress(pool)) continue;
      launches.set(pool.toLowerCase(), {
        deployer: fields.get('deployer') ?? '',
        positionId: fields.get('positionId') ?? '',
        devBuyWeth: Number(fields.get('initialBuyAmount') ?? 0) / 1e18,
        restrictionsEndBlock: Number(fields.get('restrictionsEndBlock') ?? 0),
      });
    }
  } catch { /* the feed still works without launch metadata */ }
  return launches;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 30, 1), 60);
  const before = Number(searchParams.get('before')) || 0;

  try {
    const [logsResponse, launches] = await Promise.all([
      fetch(`${EXPLORER}/addresses/${FACTORY}/logs`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) }),
      recentLaunches(),
    ]);
    if (!logsResponse.ok) throw new Error('explorer unavailable');
    const body = await logsResponse.json() as { items?: ExplorerLog[] };

    const created = (body.items ?? [])
      .filter(item => (item.topics?.[0] ?? '').toLowerCase() === POOL_CREATED)
      .filter(item => !before || (item.block_number ?? 0) < before)
      .map(item => {
        const topics = item.topics ?? [];
        const token0 = topics[1] ? `0x${topics[1].slice(-40)}` : '';
        const token1 = topics[2] ? `0x${topics[2].slice(-40)}` : '';
        // data is (int24 tickSpacing, address pool) — the pool is the second word.
        const pool = item.data && item.data.length >= 130 ? `0x${item.data.slice(-40)}` : '';
        if (!isAddress(token0) || !isAddress(token1) || !isAddress(pool)) return null;
        const tokenIsToken0 = token1.toLowerCase() === WETH;
        const token = tokenIsToken0 ? token0 : token1;
        // Pools that pair two non-WETH tokens have no WETH leg to price against.
        if (token0.toLowerCase() !== WETH && token1.toLowerCase() !== WETH) return null;
        return {
          pool: getAddress(pool), token: getAddress(token), tokenIsToken0,
          fee: decodeNumber(topics[3] ?? undefined) ?? 0,
          block: item.block_number ?? 0,
          createdAt: item.block_timestamp ?? null,
          transactionHash: item.transaction_hash ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, limit);

    if (!created.length) return Response.json({ pools: [] }, { headers: { ...FEED_VARY, 'cache-control': 'no-store' } });

    // Six reads per pool in one batched round trip: identity, the pool's own
    // spot price, and both sides of its real reserves.
    const reads: Read[] = [];
    created.forEach((item, position) => {
      reads.push(
        { key: `${position}:symbol`, target: item.token, callData: encodeFunctionData({ abi: erc20Abi, functionName: 'symbol' }) },
        { key: `${position}:name`, target: item.token, callData: encodeFunctionData({ abi: erc20Abi, functionName: 'name' }) },
        { key: `${position}:decimals`, target: item.token, callData: encodeFunctionData({ abi: erc20Abi, functionName: 'decimals' }) },
        { key: `${position}:slot0`, target: item.pool, callData: SLOT0_SELECTOR },
        { key: `${position}:weth`, target: WETH, callData: encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [item.pool as `0x${string}`] }) },
      );
      // Trust but verify: the launch event says the position was locked, this
      // confirms the NFT is still sitting in the locker right now.
      const launch = launches.get(item.pool.toLowerCase());
      if (launch?.positionId) {
        reads.push({ key: `${position}:lpOwner`, target: POSITION_MANAGER, callData: `${OWNER_OF_SELECTOR}${BigInt(launch.positionId).toString(16).padStart(64, '0')}` });
      }
    });

    const [results, wethUsd] = await Promise.all([aggregate3(reads), wethUsdPrice()]);
    const values = new Map<string, string>();
    results.forEach((result, position) => {
      if (result.success && result.data !== '0x') values.set(reads[position].key, result.data);
    });
    const now = Date.now();

    const pools: NewPool[] = created.map((item, position) => {
      const at = (suffix: string) => values.get(`${position}:${suffix}`);
      const symbol = decodeString(at('symbol'));
      const decimals = decodeNumber(at('decimals')) ?? 18;
      const sqrtPriceX96 = decodeBigInt(at('slot0')) ?? 0n;
      const launch = launches.get(item.pool.toLowerCase());
      const lpOwnerRaw = at('lpOwner');
      const lpOwner = lpOwnerRaw && lpOwnerRaw.length >= 66 ? `0x${lpOwnerRaw.slice(-40)}` : null;
      const priceWeth = priceFromSlot0(sqrtPriceX96, item.tokenIsToken0, decimals);
      const wethLiquidity = Number(decodeBigInt(at('weth')) ?? 0n) / 1e18;
      const createdMs = item.createdAt ? Date.parse(item.createdAt) : NaN;
      return {
        pool: item.pool,
        token: item.token,
        symbol: symbol || 'TOKEN',
        name: decodeString(at('name')) || symbol || 'Unknown token',
        decimals,
        fee: item.fee,
        block: item.block,
        createdAt: item.createdAt,
        ageSeconds: Number.isFinite(createdMs) ? Math.max(0, Math.round((now - createdMs) / 1000)) : null,
        priceWeth,
        priceUsd: priceWeth * wethUsd,
        // Both sides of a full-range pool are the WETH leg doubled; the WETH
        // leg alone is the honest number for how much you can actually sell into.
        wethLiquidity,
        liquidityUsd: wethLiquidity * wethUsd,
        transactionHash: item.transactionHash,
        tokenIsToken0: item.tokenIsToken0,
        resolved: Boolean(symbol) && sqrtPriceX96 > 0n,
        launchpad: Boolean(launch),
        deployer: launch?.deployer ?? null,
        lpOwner,
        lpLocked: launch?.positionId ? (lpOwner ? lpOwner.toLowerCase() === LAUNCH_LOCKER.toLowerCase() : null) : false,
        devBuyWeth: launch?.devBuyWeth ?? 0,
        devBuyUsd: (launch?.devBuyWeth ?? 0) * wethUsd,
        restrictionsEndBlock: launch?.restrictionsEndBlock ?? null,
      };
    });

    return Response.json(
      { pools, wethUsd, cursor: pools.length ? pools[pools.length - 1].block : null },
      { headers: { ...FEED_VARY, 'cache-control': 'no-store' } },
    );
  } catch (reason) {
    console.error('[new-pools]', reason);
    return Response.json({ error: 'launch feed unavailable', pools: [] }, { status: 502, headers: { ...FEED_VARY, 'cache-control': 'no-store' } });
  }
}
