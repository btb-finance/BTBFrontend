/**
 * Seed OPOS Uniswap V2 pairs from the treasury, priced at the BTB peg.
 *
 *   npx tsx scripts/opos-seed-pairs.ts            dry run: prints every amount, signs nothing
 *   npx tsx scripts/opos-seed-pairs.ts --send     mints, swaps, approves and adds liquidity
 *
 * Reads TREASURY_PRIVATE_KEY from the environment. Nothing else is stored.
 *
 * Pricing: new pools open at the median implied OPOS price of the existing
 * OPOS V2 pools (where bots already keep it balanced). The peg (BTB / 1e6,
 * since OPOS burns to BTB untaxed; BTB read from its Uniswap V4 pools via
 * StateView) is the sanity check: the run aborts if the two disagree by more
 * than MAX_REFERENCE_GAP. Every token price is read on-chain from its
 * deepest Uniswap V3 pool against USDC or WETH, so no API can spoof a seed.
 *
 * Each pair opens at exactly $USD_PER_SIDE of OPOS and $USD_PER_SIDE of the
 * token. LP tokens go to the Safe so a pair can be unwound later.
 */
import { createPublicClient, createWalletClient, http, fallback, parseAbi, erc20Abi, formatUnits, parseUnits, encodeFunctionData, getAddress, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import { getKyberQuote, buildKyberTx } from '../src/lib/kyberswap';

// ── Settings ────────────────────────────────────────────────────────────────
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
const TOKENS: { symbol: string; address: Address; via: 'USDC' | 'WETH' }[] = TOKENS_RAW.map((t) => ({ ...t, address: getAddress(t.address.toLowerCase()) }));

// ── ABIs ────────────────────────────────────────────────────────────────────
const FACTORY_ABI = parseAbi(['function getPair(address,address) view returns (address)']);
const PAIR_ABI = parseAbi(['function getReserves() view returns (uint112,uint112,uint32)', 'function token0() view returns (address)']);
const V3_FACTORY_ABI = parseAbi(['function getPool(address,address,uint24) view returns (address)']);
const V3_POOL_ABI = parseAbi(['function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)', 'function liquidity() view returns (uint128)']);
const STATE_VIEW_ABI = parseAbi(['function getSlot0(bytes32) view returns (uint160,int24,uint24,uint24)']);
const ROUTER_ABI = parseAbi(['function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)']);
const OPOS_ABI = parseAbi(['function mint(uint256) returns (uint256)', 'function treasury() view returns (address)']);

const client = createPublicClient({ chain: mainnet, transport: fallback(['https://eth.api.pocket.network', 'https://gateway.tenderly.co/public/mainnet', 'https://eth.rpc.blxrbdn.com', 'https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'].map((u) => http(u, { timeout: 15_000 }))) });

const send = process.argv.includes('--send');
const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { maximumFractionDigits: d });

function sqrtToPrice(sqrtPriceX96: bigint, dec0: number, dec1: number): number {
  const s = Number(sqrtPriceX96) / 2 ** 96;
  return s * s * 10 ** (dec0 - dec1); // token1 per token0
}

/** USD price of `token` from its deepest V3 pool against USDC (6) or WETH. */
async function v3PriceUsd(token: Address, via: 'USDC' | 'WETH', wethUsd: number, decimals: number): Promise<number> {
  const p = await v3PriceUsdOrNull(token, via, wethUsd, decimals) ?? (via === 'WETH' ? await v3PriceUsdOrNull(token, 'USDC', wethUsd, decimals) : await v3PriceUsdOrNull(token, 'WETH', wethUsd, decimals));
  if (p == null) throw new Error(`no V3 pool for ${token}`);
  return p;
}

/** Null when the token has no Uniswap V3 pool against the quote (V4-only tokens). */
async function v3PriceUsdOrNull(token: Address, via: 'USDC' | 'WETH', wethUsd: number, decimals: number): Promise<number | null> {
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

async function main() {
  console.log(send ? 'LIVE RUN' : 'DRY RUN (add --send to execute)');
  const account = send ? privateKeyToAccount(process.env.TREASURY_PRIVATE_KEY as `0x${string}`) : null;
  const treasury = await client.readContract({ address: OPOS, abi: OPOS_ABI, functionName: 'treasury' });
  if (account && account.address.toLowerCase() !== treasury.toLowerCase()) throw new Error(`Key is ${account.address}, OPOS treasury is ${treasury}; seeds from anywhere else are taxed`);
  const from = account?.address ?? treasury;
  console.log('treasury', treasury);

  // 1) Reference prices, all on-chain.
  const wethUsd = await v3PriceUsd(WETH, 'USDC', 0, 18);
  const btbSlots = await client.multicall({ contracts: BTB_V4_POOLS.map((id) => ({ address: V4_STATE_VIEW, abi: STATE_VIEW_ABI, functionName: 'getSlot0' as const, args: [id] as const })), allowFailure: true });
  const btbPrices: number[] = [];
  // BTB / USDC: BTB (0x8888...) sorts before USDC (0xA0b8...), so price = USDC per BTB.
  if (btbSlots[0].status === 'success') btbPrices.push(sqrtToPrice((btbSlots[0].result as readonly [bigint, number, number, number])[0], 18, 6));
  // BTB / ETH: native ETH is currency0 (address zero), so price = BTB per ETH; invert.
  if (btbSlots[1].status === 'success') btbPrices.push(wethUsd / sqrtToPrice((btbSlots[1].result as readonly [bigint, number, number, number])[0], 18, 18));
  if (btbPrices.length === 0) throw new Error('could not read BTB V4 pools');
  const btbUsd = btbPrices.reduce((a, b) => a + b, 0) / btbPrices.length;
  const pegOpos = btbUsd / 1_000_000;

  // Cross-check: median implied OPOS price across the existing pools.
  const existing = await client.multicall({ contracts: TOKENS.map((t) => ({ address: V2_FACTORY, abi: FACTORY_ABI, functionName: 'getPair' as const, args: [OPOS, t.address] as const })), allowFailure: true });
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
    const otherUsd = await v3PriceUsd(known[i], 'WETH', wethUsd, dec);
    if (oposRes > 0n) implied.push((Number(formatUnits(otherRes, dec)) * otherUsd) / Number(formatUnits(oposRes, 18)));
  }
  implied.sort((a, b) => a - b);
  const median = implied[Math.floor(implied.length / 2)];
  const gap = median / pegOpos - 1;
  console.log(`WETH $${fmt(wethUsd)}  BTB $${btbUsd.toExponential(4)}  peg OPOS ${pegOpos.toExponential(4)}  pool median ${median.toExponential(4)}  gap ${(gap * 100).toFixed(2)}%`);
  if (Math.abs(gap) > MAX_REFERENCE_GAP) throw new Error('peg and pool median disagree; check the BTB pools before seeding');
  // Seed where the market already clears OPOS: the median of the existing
  // pools, which bots keep balanced against each other. The peg is the sanity
  // check above. At $200 a pool the value a bot can extract from a price gap
  // d is about V * d^2 / 8, cents even at the full peg-to-market gap, so
  // consistency with the live pools matters more than the last percent.
  const oposUsd = median;
  const oposPerSide = parseUnits((USD_PER_SIDE / oposUsd).toFixed(0), 18);

  // 2) Per-token plan.
  const decs = await client.multicall({ contracts: TOKENS.map((t) => ({ address: t.address, abi: erc20Abi, functionName: 'decimals' as const })), allowFailure: false });
  const plan: { t: (typeof TOKENS)[number]; dec: number; usd: number; amount: bigint; pair: Address; v3: boolean; spot?: number }[] = [];
  for (let i = 0; i < TOKENS.length; i++) {
    const t = TOKENS[i], dec = Number(decs[i]);
    const v3 = await v3PriceUsdOrNull(t.address, t.via, wethUsd, dec) ?? await v3PriceUsdOrNull(t.address, t.via === 'WETH' ? 'USDC' : 'WETH', wethUsd, dec);
    // No V3 pool (V4-only tokens): the price comes from the Kyber quote in the simulation, checked against DeFiLlama.
    const usd = v3 ?? 0;
    const amount = usd > 0 ? parseUnits((USD_PER_SIDE / usd).toFixed(Math.min(dec, 8)), dec) : 0n;
    const pair = existing[i].status === 'success' ? (existing[i].result as Address) : '0x0000000000000000000000000000000000000000';
    plan.push({ t, dec, usd, amount, pair, v3: v3 != null });
  }
  console.log('\nsymbol   price USD        token amount          OPOS amount            pair');
  for (const p of plan) console.log(`${p.t.symbol.padEnd(8)} ${(p.v3 ? fmt(p.usd, 6) : 'no V3, see sim').padStart(14)}  ${formatUnits(p.amount, p.dec).padStart(20)}  ${formatUnits(oposPerSide, 18).padStart(22)}  ${p.pair === '0x0000000000000000000000000000000000000000' ? '(new)' : p.pair}`);
  // 2b) Simulation: an independent price from a live Kyber $100 quote and from
  //     DeFiLlama, compared with the on-chain V3 price. A token whose sources
  //     disagree is dropped from the run; nothing is seeded on a doubtful price.
  console.log('\nSIMULATION: three prices per token, arbitrage band check');
  const llama = await fetch(`https://coins.llama.fi/prices/current/${plan.map((p) => `ethereum:${p.t.address.toLowerCase()}`).join(',')}`, { headers: { 'user-agent': 'curl/8' } })
    .then((r) => r.json() as Promise<{ coins: Record<string, { price?: number }> }>).catch(() => ({ coins: {} as Record<string, { price?: number }> }));
  const safe: typeof plan = [];
  console.log('symbol   V3 price       market (\$20)   Llama price    max gap  impact  verdict');
  for (const p of plan) {
    // Two quotes: $20 is close to the clean market price; the $100 quote is
    // what we would actually pay, so the difference is our own price impact.
    let kyber: number | null = null, spot: number | null = null, impact = 0;
    if (p.t.address.toLowerCase() !== USDC.toLowerCase()) {
      try {
        const qSmall = await getKyberQuote(USDC, p.t.address, parseUnits('20', 6).toString(), p.dec, 1);
        const outSmall = BigInt(qSmall.routeSummary.amountOut ?? '0');
        if (outSmall > 0n) spot = 20 / Number(formatUnits(outSmall, p.dec));
        await new Promise((r) => setTimeout(r, 250));
        const q = await getKyberQuote(USDC, p.t.address, parseUnits(String(USD_PER_SIDE), 6).toString(), p.dec, 1);
        const out = BigInt(q.routeSummary.amountOut ?? '0');
        if (out > 0n) kyber = USD_PER_SIDE / Number(formatUnits(out, p.dec));
        if (spot != null && kyber != null) impact = kyber / spot - 1;
      } catch { /* no quote */ }
      await new Promise((r) => setTimeout(r, 250));
    } else { kyber = 1; spot = 1; }
    // The market price we pair against is the clean one, not the one we paid.
    const market = spot ?? kyber;
    p.spot = market ?? undefined;
    const ll = llama.coins?.[`ethereum:${p.t.address.toLowerCase()}`]?.price ?? null;
    let note = '';
    const marketAgree = kyber != null && ll != null && Math.abs(kyber / ll - 1) <= PRICE_AGREEMENT;
    if ((!p.v3 || (marketAgree && Math.abs(p.usd / kyber! - 1) > PRICE_AGREEMENT)) && marketAgree) {
      // No usable V3 pool, or a V3 pool that disagrees with a market the two
      // independent sources agree on: price from the live quote instead.
      note = p.v3 ? ' (V3 pool stale, priced from market)' : ' (no V3 pool, priced from market)';
      p.usd = market!; p.amount = parseUnits((USD_PER_SIDE / market!).toFixed(Math.min(p.dec, 8)), p.dec); p.v3 = false;
    }
    const prices = [p.v3 ? p.usd : null, market, ll].filter((x): x is number => x != null && x > 0);
    const lo = Math.min(...prices), hi = Math.max(...prices);
    const gap = prices.length >= 2 ? hi / lo - 1 : NaN;
    // Kyber's effective price includes the buy's own slippage on a $100 trade;
    // a gap above the band means the buy itself would open the pool off-price.
    const tooThin = Math.abs(impact) > MAX_IMPACT;
    const ok = prices.length >= 2 && gap <= PRICE_AGREEMENT && p.usd > 0 && !tooThin && (market == null || Math.abs(market / p.usd - 1) < ARB_BAND);
    if (tooThin) note += ` (our \$${USD_PER_SIDE} buy moves it ${(impact * 100).toFixed(2)}%)`;
    console.log(`${p.t.symbol.padEnd(8)} ${(p.v3 ? fmt(p.usd, 6) : 'n/a').padStart(14)} ${(market != null ? fmt(market, 6) : 'n/a').padStart(14)} ${(ll != null ? fmt(ll, 6) : 'n/a').padStart(14)}  ${Number.isFinite(gap) ? (gap * 100).toFixed(2) + '%' : '  n/a'}  ${(impact * 100).toFixed(2).padStart(5)}%  ${ok ? 'seed' : 'HOLD'}${note}`);
    if (ok) safe.push(p);
  }
  const held = plan.filter((p) => !safe.includes(p)).map((p) => p.t.symbol);
  console.log(`\n${safe.length} of ${plan.length} pass. ${held.length ? 'Held back: ' + held.join(', ') : 'Nothing held back.'}`);
  console.log(`Peg vs pool median gap ${(gap * 100).toFixed(2)}% (band ${(ARB_BAND * 100).toFixed(1)}%): ${Math.abs(gap) <= ARB_BAND ? 'inside, existing pools stay unaffected' : 'outside; new pools open at the peg and the old ones will be arbitraged toward it, which is expected'}`);
  plan.length = 0; plan.push(...safe);

  const totalOpos = oposPerSide * BigInt(plan.length);
  const btbToMint = totalOpos / 1_000_000n + 1n;
  console.log(`\nOPOS needed ${formatUnits(totalOpos, 18)}  =  mint from ${formatUnits(btbToMint, 18)} BTB  (${fmt(Number(formatUnits(btbToMint, 18)) * btbUsd)} USD)`);
  console.log(`USDC needed ${plan.length * USD_PER_SIDE} plus swap slippage; LP tokens go to ${LP_RECIPIENT}`);

  if (!send || !account) return;

  // 3) Execute. Wallet client with the treasury key.
  const wallet = createWalletClient({ account, chain: mainnet, transport: http('https://eth.api.pocket.network') });
  const tx = async (label: string, to: Address, data: `0x${string}`, value?: bigint) => {
    const hash = await wallet.sendTransaction({ to, data, value });
    process.stdout.write(`${label} ${hash} `);
    const rc = await client.waitForTransactionReceipt({ hash });
    console.log(rc.status);
    if (rc.status !== 'success') throw new Error(`${label} reverted`);
  };
  const approveIfNeeded = async (token: Address, spender: Address, amount: bigint, label: string) => {
    const allowance = await client.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [from, spender] });
    if (allowance >= amount) return;
    await tx(`approve ${label}`, token, encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, amount] }));
  };

  // 3a) Mint OPOS from BTB if the treasury holds less than needed.
  const oposBal = await client.readContract({ address: OPOS, abi: erc20Abi, functionName: 'balanceOf', args: [from] });
  if (oposBal < totalOpos) {
    const need = (totalOpos - oposBal) / 1_000_000n + 1n;
    const btbBal = await client.readContract({ address: BTB, abi: erc20Abi, functionName: 'balanceOf', args: [from] });
    if (btbBal < need) throw new Error(`need ${formatUnits(need, 18)} BTB to mint, treasury holds ${formatUnits(btbBal, 18)}`);
    await approveIfNeeded(BTB, OPOS, need, 'BTB to OPOS');
    await tx('mint OPOS', OPOS, encodeFunctionData({ abi: OPOS_ABI, functionName: 'mint', args: [need] }));
  }

  // 3b) Swap USDC into each token that the treasury does not already hold enough of.
  for (const p of plan) {
    if (p.t.address.toLowerCase() === USDC.toLowerCase()) continue;
    const bal = await client.readContract({ address: p.t.address, abi: erc20Abi, functionName: 'balanceOf', args: [from] });
    if (bal >= p.amount) continue;
    const usdcIn = parseUnits((USD_PER_SIDE * 1.01).toFixed(6), 6);
    const q = await getKyberQuote(USDC, p.t.address, usdcIn.toString(), p.dec, 1);
    const built = await buildKyberTx(q.routeSummary, q.routerAddress, from, from, SWAP_SLIPPAGE_BPS, 1);
    await approveIfNeeded(USDC, getAddress(q.routerAddress), usdcIn, `USDC for ${p.t.symbol}`);
    await tx(`swap USDC to ${p.t.symbol}`, getAddress(built.to), built.data as `0x${string}`, built.value ? BigInt(built.value) : undefined);
  }

  // 3c) Approvals to the router, then one addLiquidity per pair. The OPOS side
  //     is sized from the tokens that actually arrived at the clean market
  //     price, so a swap that lost a little to slippage opens the pool at the
  //     market ratio (a touch under $100 a side) rather than off-price.
  await approveIfNeeded(OPOS, V2_ROUTER, totalOpos, 'OPOS to router');
  for (const p of plan) {
    const bal = await client.readContract({ address: p.t.address, abi: erc20Abi, functionName: 'balanceOf', args: [from] });
    const amount = bal < p.amount ? bal : p.amount;
    const tokenUsd = Number(formatUnits(amount, p.dec)) * (p.spot ?? p.usd);
    const oposAmount = parseUnits((tokenUsd / oposUsd).toFixed(0), 18);
    await approveIfNeeded(p.t.address, V2_ROUTER, amount, `${p.t.symbol} to router`);
    const min = (v: bigint) => (v * BigInt(10_000 - SLIPPAGE_BPS)) / 10_000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_S);
    console.log(`  ${p.t.symbol}: ${formatUnits(amount, p.dec)} ($${tokenUsd.toFixed(2)}) against ${formatUnits(oposAmount, 18)} OPOS`);
    await tx(`addLiquidity OPOS/${p.t.symbol}`, V2_ROUTER, encodeFunctionData({ abi: ROUTER_ABI, functionName: 'addLiquidity', args: [OPOS, p.t.address, oposAmount, amount, min(oposAmount), min(amount), LP_RECIPIENT, deadline] }));
  }
  console.log('\ndone');
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
