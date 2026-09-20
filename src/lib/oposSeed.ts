/**
 * OPOS pair seeding, shared by the CLI script and the in-app page. Pure
 * reads and call builders: nothing here signs. See scripts/opos-seed-pairs.ts
 * for the pricing rules and the safety bands.
 */
import { parseAbi, erc20Abi, formatUnits, parseUnits, encodeFunctionData, getAddress, type Address, type PublicClient } from 'viem';
import { getKyberQuote, buildKyberTx } from './kyberswap';

const USD_PER_SIDE = 100;
const LP_RECIPIENT: Address = '0x98834162FE037a3d213A908162dB5e2dED8cba77'; // BTB Safe
const SLIPPAGE_BPS = 50;            // amountMin on addLiquidity
const SWAP_SLIPPAGE_BPS = 100;      // KyberSwap USDC to token
const MAX_REFERENCE_GAP = 0.10;     // abort if peg vs pool median differ more than this
const DEADLINE_S = 120;
// A bot profits on a fresh $200 pool only when its opening price is off by
// more than the round trip cost: 1% OPOS tax each way plus 0.3% fee each way
// plus slippage on a tiny pool. Anything inside this band is safe by
// construction; the simulation refuses to seed outside it.
const ARB_BAND = 0.013;
// The three price sources must agree this closely or the token is held back.
const PRICE_AGREEMENT = ARB_BAND;
// Our own \$100 buy must not move a thin pool more than this, or the token waits.
const MAX_IMPACT = 0.005;

const OPOS: Address = '0x88888805E7e3d5c7FB002AD98f08250E79c298dC';
const BTB: Address = '0x88888888c90CD71B35830daBFD24743DbC135B51';
const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const V2_FACTORY: Address = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const V2_ROUTER: Address = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const V3_FACTORY: Address = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const V4_STATE_VIEW: Address = '0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227';
const BTB_V4_POOLS: `0x${string}`[] = [
  '0x950305f70d41db77caa577efdb28ee01b52e77361bb3a11a7cb18913f1c29f63', // BTB / USDC
  '0x1f387248ce0d9885afce0556e0ee14867b10e2272c797bd9e4a79fffec6626c2', // BTB / ETH
];

/** Tokens to pair with OPOS. `via` is the quote token of the V3 pool the price is read from. */

export { USD_PER_SIDE, LP_RECIPIENT, SLIPPAGE_BPS, SWAP_SLIPPAGE_BPS, ARB_BAND, PRICE_AGREEMENT, MAX_IMPACT, OPOS, BTB, USDC, WETH, V2_ROUTER };
const TOKENS_RAW: { symbol: string; address: string; via: 'USDC' | 'WETH' }[] = [
  // Anchors
  { symbol: 'WETH',   address: WETH, via: 'USDC' },
  { symbol: 'USDC',   address: USDC, via: 'USDC' },
  // Bitcoin
  { symbol: 'WBTC',   address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', via: 'USDC' },
  { symbol: 'cbBTC',  address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', via: 'USDC' },
  { symbol: 'LBTC',   address: '0x8236a87084f8B84306f72007F36F2618A5634494', via: 'WETH' },
  { symbol: 'cirBTC', address: '0x72dfB2E44f59C5ad2BaFE84314e5b99A7CD5075E', via: 'WETH' },
  // Staked ETH
  { symbol: 'wstETH', address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', via: 'WETH' },
  { symbol: 'weETH',  address: '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee', via: 'WETH' },
  { symbol: 'rETH',   address: '0xae78736Cd615f374D3085123A210448E74Fc6393', via: 'WETH' },
  // Gold
  { symbol: 'PAXG',   address: '0x45804880De22913dAFE09f4980848ECE6EcbAf78', via: 'USDC' },
  { symbol: 'XAUt',   address: '0x68749665FF8D2d112Fa859AA293F07A622782F38', via: 'USDC' },
  // Revenue earners
  { symbol: 'SKY',    address: '0x56072C95FAA701256059aa122697B133aDEd9279', via: 'WETH' },
  { symbol: 'ETHFI',  address: '0xFe0c30065B384F05761f15d0CC899D4F9F9Cc0eB', via: 'WETH' },
  { symbol: 'SYRUP',  address: '0x643C4E15d7d62Ad0aBeC4a9BD4b001aA3Ef52d66', via: 'WETH' },
  { symbol: 'SPK',    address: '0xc20059e0317DE91738d13af027DfC4a50781b066', via: 'WETH' },
  { symbol: 'MKR',    address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', via: 'WETH' },
  { symbol: 'FWA',    address: '0xa0Df17B5aC76ABaBA36E1450E2cbCd18A620C845', via: 'WETH' },
  // AI season
  { symbol: 'ZAMA',   address: '0xA12CC123ba206d4031D1c7f6223D1C2Ec249f4f3', via: 'WETH' },
  { symbol: 'AZTEC',  address: '0xA27EC0006e59f245217Ff08CD52A7E8b169E62D2', via: 'WETH' },
  // Infrastructure
  { symbol: 'MNT',    address: '0x3c3a81e81dc49A522A592e7622A7E711c06bf354', via: 'WETH' },
  { symbol: 'LIT',    address: '0x232ce3BD40fCD6F80f3d55a522d03f25df784Ee2', via: 'WETH' },
  { symbol: 'LQTY',   address: '0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D', via: 'WETH' },
  { symbol: 'SSV',    address: '0x9D65fF81a3c488d585bBfb0Bfe3c7707c7917f54', via: 'WETH' },
  { symbol: 'STRK',   address: '0xCa14007Eff0dB1f8135f4C25B34De49AB0d42766', via: 'WETH' },
  { symbol: 'OHM',    address: '0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5', via: 'WETH' },
  { symbol: 'SAFE',   address: '0x5aFE3855358E112B5647B952709E6165e1c1eEEe', via: 'WETH' },
  // Protocol tokens
  { symbol: 'ENS',    address: '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72', via: 'WETH' },
  { symbol: '1INCH',  address: '0x111111111117dC0aa78b770fA6A738034120C302', via: 'WETH' },
  { symbol: 'EIGEN',  address: '0xec53bF9167f50cDEB3Ae105f56099aaaB9061F83', via: 'WETH' },
  { symbol: 'FET',    address: '0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85', via: 'WETH' },
  { symbol: 'RENDER', address: '0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24', via: 'WETH' },
  { symbol: 'INJ',    address: '0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30', via: 'WETH' },
  { symbol: 'GRT',    address: '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', via: 'WETH' },
  { symbol: 'GNO',    address: '0x6810e776880C02933D47DB1b9fc05908e5386b96', via: 'WETH' },
  { symbol: 'YFI',    address: '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e', via: 'WETH' },
  { symbol: 'KNC',    address: '0xdeFA4e8a7bcBA345F687a2f1456F5Edd9CE97202', via: 'WETH' },
  { symbol: 'USUAL',  address: '0xC4441c2BE5d8fA8126822B9929CA0b81Ea0DE38E', via: 'WETH' },
  { symbol: 'CFG',    address: '0xcccccccccc33D538dBC2EE4FEab0A7A1FF4E8A94', via: 'WETH' },
  // Privacy and data
  { symbol: 'RAIL',   address: '0xe76C6c83af64e4C60245D8C7dE953DF673a7A33D', via: 'WETH' },
  { symbol: 'TRAC',   address: '0xaA7a9CA87d3694B5755f213B5D04094b8d0F0A6F', via: 'WETH' },
  // Gaming, DEX
  { symbol: 'ILV',    address: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E', via: 'WETH' },
  { symbol: 'SUSHI',  address: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2', via: 'WETH' },
  // Memes with deep pools
  { symbol: 'SPX',    address: '0xE0f63A424a4439cBE457D80E4f4b51aD25b2c56C', via: 'WETH' },
  { symbol: 'FLOKI',  address: '0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E', via: 'WETH' },
  { symbol: 'MOG',    address: '0xaaeE1A9723aaDB7afA2810263653A34bA2C21C7a', via: 'WETH' },
  { symbol: 'SHIB',   address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', via: 'WETH' },
  // Old but liquid
  { symbol: 'ZRX',    address: '0xE41d2489571d322189246DaFA5ebDe1F4699F498', via: 'WETH' },
  { symbol: 'RSR',    address: '0x320623b8E4fF03373931769A31Fc52A4E78B5d70', via: 'WETH' },
  { symbol: 'BAT',    address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF', via: 'WETH' },
  // Created, never funded
  { symbol: 'CRV',    address: '0xD533a949740bb3306d119CC777fa900bA034cd52', via: 'WETH' },
];
// Addresses above are typed by hand; checksum them once so a casing slip cannot reach a transaction.

export const TOKENS: { symbol: string; address: Address; via: 'USDC' | 'WETH' }[] = TOKENS_RAW.map((t) => ({ ...t, address: getAddress(t.address.toLowerCase()) }));

export const FACTORY_ABI = parseAbi(['function getPair(address,address) view returns (address)']);
export const PAIR_ABI = parseAbi(['function getReserves() view returns (uint112,uint112,uint32)', 'function token0() view returns (address)']);
export const V3_FACTORY_ABI = parseAbi(['function getPool(address,address,uint24) view returns (address)']);
export const V3_POOL_ABI = parseAbi(['function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)', 'function liquidity() view returns (uint128)']);
export const STATE_VIEW_ABI = parseAbi(['function getSlot0(bytes32) view returns (uint160,int24,uint24,uint24)']);
export const ROUTER_ABI = parseAbi(['function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)']);
export const OPOS_ABI = parseAbi(['function mint(uint256) returns (uint256)', 'function treasury() view returns (address)']);

export const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { maximumFractionDigits: d });

export function sqrtToPrice(sqrtPriceX96: bigint, dec0: number, dec1: number): number {
  const s = Number(sqrtPriceX96) / 2 ** 96;
  return s * s * 10 ** (dec0 - dec1); // token1 per token0
}

/** USD price of `token` from its deepest V3 pool against USDC (6) or WETH. */
export async function v3PriceUsd(client: PublicClient, token: Address, via: 'USDC' | 'WETH', wethUsd: number, decimals: number): Promise<number> {
  const p = await v3PriceUsdOrNull(client, token, via, wethUsd, decimals) ?? (via === 'WETH' ? await v3PriceUsdOrNull(client, token, 'USDC', wethUsd, decimals) : await v3PriceUsdOrNull(client, token, 'WETH', wethUsd, decimals));
  if (p == null) throw new Error(`no V3 pool for ${token}`);
  return p;
}

/** Null when the token has no Uniswap V3 pool against the quote (V4-only tokens). */
export async function v3PriceUsdOrNull(client: PublicClient, token: Address, via: 'USDC' | 'WETH', wethUsd: number, decimals: number): Promise<number | null> {
  if (token.toLowerCase() === USDC.toLowerCase()) return 1;
  const quote = via === 'USDC' ? USDC : WETH;
  const quoteDec = via === 'USDC' ? 6 : 18;
  const pools = await client.multicall({ contracts: [100, 500, 3000, 10000].map((fee) => ({ address: V3_FACTORY, abi: V3_FACTORY_ABI, functionName: 'getPool' as const, args: [token, quote, fee] as const })), allowFailure: true });
  const addrs = pools.map((r) => (r.status === 'success' ? (r.result as Address) : null)).filter((a): a is Address => !!a && a !== '0x0000000000000000000000000000000000000000');
  if (addrs.length === 0) return null;
  // Depth is judged by the quote token actually sitting in the pool, which is
  // comparable across fee tiers; raw liquidity() is not. Pools with no price
  // (never initialised) or under $25K of quote are ignored: a stale pool
  // would seed OPOS at a wrong price and a bot would collect the difference.
  const reads = await client.multicall({ contracts: addrs.flatMap((a) => [{ address: a, abi: V3_POOL_ABI, functionName: 'slot0' as const }, { address: quote, abi: erc20Abi, functionName: 'balanceOf' as const, args: [a] as const }]), allowFailure: true });
  let best: { liq: bigint; price: number } | undefined;
  const minQuote = via === 'USDC' ? parseUnits('25000', 6) : parseUnits((25_000 / Math.max(wethUsd, 1)).toFixed(6), 18);
  addrs.forEach((_, i) => {
    const s0 = reads[i * 2], bal = reads[i * 2 + 1];
    if (s0.status !== 'success' || bal.status !== 'success') return;
    const sqrt = (s0.result as readonly [bigint, number, number, number, number, number, boolean])[0];
    if (sqrt === 0n) return;
    const token0First = token.toLowerCase() < quote.toLowerCase();
    const p = token0First ? sqrtToPrice(sqrt, decimals, quoteDec) : 1 / sqrtToPrice(sqrt, quoteDec, decimals);
    const depth = bal.result as bigint;
    if (depth < minQuote || !(p > 0) || !Number.isFinite(p)) return;
    if (!best || depth > best.liq) best = { liq: depth, price: p };
  });
  const chosen = best as { liq: bigint; price: number } | undefined;
  if (!chosen) return null;
  return via === 'USDC' ? chosen.price : chosen.price * wethUsd;
}



export { V2_FACTORY, V3_FACTORY, V4_STATE_VIEW, BTB_V4_POOLS, MAX_REFERENCE_GAP, DEADLINE_S };

export interface SeedRow {
  symbol: string; address: Address; dec: number;
  /** Clean market price used for the pair ratio. */
  usd: number;
  v3: number | null; market: number | null; llama: number | null; impact: number; gap: number;
  ok: boolean; note: string;
  amount: bigint;        // token amount for USD_PER_SIDE
  pair: Address | null;  // existing V2 pair, if any
}

export interface SeedPlan {
  wethUsd: number; btbUsd: number; pegOpos: number; median: number; gap: number; oposUsd: number;
  oposPerSide: bigint;
  rows: SeedRow[];
}

/** Reference prices and the three-source check for every token. Read-only. */
export async function buildSeedPlan(client: PublicClient, onProgress?: (msg: string) => void): Promise<SeedPlan> {
  const say = (m: string) => onProgress?.(m);
  say('Reading reference prices');
  const wethUsd = await v3PriceUsd(client, WETH, 'USDC', 0, 18);
  const btbSlots = await client.multicall({ contracts: BTB_V4_POOLS.map((id) => ({ address: V4_STATE_VIEW, abi: STATE_VIEW_ABI, functionName: 'getSlot0' as const, args: [id] as const })), allowFailure: true });
  const btbPrices: number[] = [];
  if (btbSlots[0].status === 'success') btbPrices.push(sqrtToPrice((btbSlots[0].result as readonly [bigint, number, number, number])[0], 18, 6));
  if (btbSlots[1].status === 'success') btbPrices.push(wethUsd / sqrtToPrice((btbSlots[1].result as readonly [bigint, number, number, number])[0], 18, 18));
  if (btbPrices.length === 0) throw new Error('could not read BTB V4 pools');
  const btbUsd = btbPrices.reduce((a, b) => a + b, 0) / btbPrices.length;
  const pegOpos = btbUsd / 1_000_000;

  const known = ['0x5a98fcbea516cf06857215779fd812ca3bef1b32', '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', '0x514910771af9ca656af840dff83e8264ecf986ca', '0x808507121b80c02388fad14726482e061b8da827'] as Address[];
  const refPairs = await client.multicall({ contracts: known.map((t) => ({ address: V2_FACTORY, abi: FACTORY_ABI, functionName: 'getPair' as const, args: [OPOS, t] as const })), allowFailure: false });
  const refReads = await client.multicall({ contracts: refPairs.flatMap((p) => [{ address: p, abi: PAIR_ABI, functionName: 'getReserves' as const }, { address: p, abi: PAIR_ABI, functionName: 'token0' as const }]), allowFailure: true });
  const implied: number[] = [];
  for (let i = 0; i < known.length; i++) {
    const r = refReads[i * 2], t0 = refReads[i * 2 + 1];
    if (r.status !== 'success' || t0.status !== 'success') continue;
    const [r0, r1] = r.result as readonly [bigint, bigint, number];
    const oposFirst = (t0.result as string).toLowerCase() === OPOS.toLowerCase();
    const oposRes = oposFirst ? r0 : r1, otherRes = oposFirst ? r1 : r0;
    const dec = await client.readContract({ address: known[i], abi: erc20Abi, functionName: 'decimals' });
    const otherUsd = await v3PriceUsd(client, known[i], 'WETH', wethUsd, dec);
    if (oposRes > 0n) implied.push((Number(formatUnits(otherRes, dec)) * otherUsd) / Number(formatUnits(oposRes, 18)));
  }
  implied.sort((a, b) => a - b);
  const median = implied[Math.floor(implied.length / 2)];
  const gap = median / pegOpos - 1;
  if (Math.abs(gap) > MAX_REFERENCE_GAP) throw new Error(`peg ${pegOpos.toExponential(3)} and pool median ${median.toExponential(3)} disagree by ${(gap * 100).toFixed(1)}%; check the BTB pools`);
  const oposUsd = median;
  const oposPerSide = parseUnits((USD_PER_SIDE / oposUsd).toFixed(0), 18);

  const decs = await client.multicall({ contracts: TOKENS.map((t) => ({ address: t.address, abi: erc20Abi, functionName: 'decimals' as const })), allowFailure: false });
  const pairs = await client.multicall({ contracts: TOKENS.map((t) => ({ address: V2_FACTORY, abi: FACTORY_ABI, functionName: 'getPair' as const, args: [OPOS, t.address] as const })), allowFailure: true });
  const llama = await fetch(`https://coins.llama.fi/prices/current/${TOKENS.map((t) => `ethereum:${t.address.toLowerCase()}`).join(',')}`)
    .then((r) => r.json() as Promise<{ coins: Record<string, { price?: number }> }>).catch(() => ({ coins: {} as Record<string, { price?: number }> }));

  const rows: SeedRow[] = [];
  for (let i = 0; i < TOKENS.length; i++) {
    const t = TOKENS[i], dec = Number(decs[i]);
    say(`Pricing ${t.symbol} (${i + 1}/${TOKENS.length})`);
    const v3 = await v3PriceUsdOrNull(client, t.address, t.via, wethUsd, dec) ?? await v3PriceUsdOrNull(client, t.address, t.via === 'WETH' ? 'USDC' : 'WETH', wethUsd, dec);
    let market: number | null = null, paid: number | null = null, impact = 0;
    if (t.address.toLowerCase() === USDC.toLowerCase()) { market = 1; paid = 1; }
    else {
      try {
        const qSmall = await getKyberQuote(USDC, t.address, parseUnits('20', 6).toString(), dec, 1);
        const outSmall = BigInt(qSmall.routeSummary.amountOut ?? '0');
        if (outSmall > 0n) market = 20 / Number(formatUnits(outSmall, dec));
        await new Promise((r) => setTimeout(r, 250));
        const q = await getKyberQuote(USDC, t.address, parseUnits(String(USD_PER_SIDE), 6).toString(), dec, 1);
        const out = BigInt(q.routeSummary.amountOut ?? '0');
        if (out > 0n) paid = USD_PER_SIDE / Number(formatUnits(out, dec));
        if (market != null && paid != null) impact = paid / market - 1;
      } catch { /* no quote */ }
      await new Promise((r) => setTimeout(r, 250));
    }
    const ll = llama.coins?.[`ethereum:${t.address.toLowerCase()}`]?.price ?? null;
    let usd = v3 ?? 0, note = '', usedV3 = v3 != null;
    const marketAgree = market != null && ll != null && Math.abs(market / ll - 1) <= PRICE_AGREEMENT;
    if ((!usedV3 || (marketAgree && Math.abs(usd / market! - 1) > PRICE_AGREEMENT)) && marketAgree) {
      note = usedV3 ? 'V3 pool stale, priced from market' : 'no V3 pool, priced from market';
      usd = market!; usedV3 = false;
    }
    const prices = [usedV3 ? usd : null, market, ll].filter((x): x is number => x != null && x > 0);
    const lo = Math.min(...prices), hi = Math.max(...prices);
    const gapT = prices.length >= 2 ? hi / lo - 1 : NaN;
    const tooThin = Math.abs(impact) > MAX_IMPACT;
    if (tooThin) note += `${note ? '; ' : ''}our $${USD_PER_SIDE} buy moves it ${(impact * 100).toFixed(2)}%`;
    const ok = prices.length >= 2 && gapT <= PRICE_AGREEMENT && usd > 0 && !tooThin && (market == null || Math.abs(market / usd - 1) < ARB_BAND);
    const amount = usd > 0 ? parseUnits((USD_PER_SIDE / usd).toFixed(Math.min(dec, 8)), dec) : 0n;
    const pair = pairs[i].status === 'success' && (pairs[i].result as string) !== '0x0000000000000000000000000000000000000000' ? (pairs[i].result as Address) : null;
    rows.push({ symbol: t.symbol, address: t.address, dec, usd, v3, market, llama: ll, impact, gap: gapT, ok, note, amount, pair });
  }
  return { wethUsd, btbUsd, pegOpos, median, gap, oposUsd, oposPerSide, rows };
}

/** Calls for one pair: approve token to the router and addLiquidity, OPOS sized from `tokenAmount` at the clean price. */
export function buildAddLiquidity(row: SeedRow, tokenAmount: bigint, oposUsd: number, recipient: Address = LP_RECIPIENT) {
  const tokenUsd = Number(formatUnits(tokenAmount, row.dec)) * row.usd;
  const oposAmount = parseUnits((tokenUsd / oposUsd).toFixed(0), 18);
  const min = (v: bigint) => (v * BigInt(10_000 - SLIPPAGE_BPS)) / 10_000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_S);
  return {
    oposAmount, tokenUsd,
    approveToken: { to: row.address, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [V2_ROUTER, tokenAmount] }) },
    approveOpos: { to: OPOS, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [V2_ROUTER, oposAmount] }) },
    add: { to: V2_ROUTER, data: encodeFunctionData({ abi: ROUTER_ABI, functionName: 'addLiquidity', args: [OPOS, row.address, oposAmount, tokenAmount, min(oposAmount), min(tokenAmount), recipient, deadline] }) },
  };
}

/** Calls to buy USD_PER_SIDE of a token with USDC through KyberSwap. */
export async function buildBuy(row: SeedRow, account: Address) {
  const usdcIn = parseUnits((USD_PER_SIDE * 1.01).toFixed(6), 6);
  const q = await getKyberQuote(USDC, row.address, usdcIn.toString(), row.dec, 1);
  const built = await buildKyberTx(q.routeSummary, q.routerAddress, account, account, SWAP_SLIPPAGE_BPS, 1);
  return {
    usdcIn,
    approve: { to: USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [getAddress(q.routerAddress), usdcIn] }) },
    swap: { to: getAddress(built.to), data: built.data as `0x${string}`, value: built.value ? BigInt(built.value) : undefined },
  };
}

/** Calls to mint OPOS from BTB (approve then mint). */
export function buildMintOpos(btbAmount: bigint) {
  return {
    approve: { to: BTB, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [OPOS, btbAmount] }) },
    mint: { to: OPOS, data: encodeFunctionData({ abi: OPOS_ABI, functionName: 'mint', args: [btbAmount] }) },
  };
}
