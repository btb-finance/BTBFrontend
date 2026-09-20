/**
 * Seed OPOS Uniswap V2 pairs from the treasury, priced at the BTB peg.
 *
 *   npx tsx scripts/opos-seed-pairs.ts            dry run: prints every amount, signs nothing
 *   npx tsx scripts/opos-seed-pairs.ts --send     mints, swaps, approves and adds liquidity
 *
 * Reads TREASURY_PRIVATE_KEY from the environment. Nothing else is stored.
 *
 * Pricing: OPOS is redeemable 1,000,000 : 1 for BTB with no tax, so its fair
 * value is BTB / 1e6. BTB is read from its Uniswap V4 pools (StateView slot0,
 * USDC and ETH pools, averaged), cross-checked against the median implied
 * price of the existing OPOS V2 pools; the run aborts if the two disagree by
 * more than MAX_REFERENCE_GAP. Every token price is read on-chain from its
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
const TOKENS: { symbol: string; address: Address; via: 'USDC' | 'WETH' }[] = [
  { symbol: 'WETH',   address: WETH, via: 'USDC' },
  { symbol: 'USDC',   address: USDC, via: 'USDC' },
  { symbol: 'WBTC',   address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', via: 'USDC' },
  { symbol: 'cbBTC',  address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', via: 'USDC' },
  { symbol: 'LBTC',   address: '0x8236a87084f8B84306f72007F36F2618A5634494', via: 'WETH' },
  { symbol: 'cirBTC', address: '0x72dfB2E44f59C5ad2BaFE84314e5b99A7CD5075E', via: 'WETH' },
  { symbol: 'stETH',  address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', via: 'WETH' },
  { symbol: 'wstETH', address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', via: 'WETH' },
  { symbol: 'weETH',  address: '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee', via: 'WETH' },
  { symbol: 'rETH',   address: '0xae78736Cd615f374D3085123A210448E74Fc6393', via: 'WETH' },
  { symbol: 'PAXG',   address: '0x45804880De22913dAFE09f4980848ECE6EcbAf78', via: 'USDC' },
  { symbol: 'XAUt',   address: '0x68749665FF8D2d112Fa859AA293F07A622782F38', via: 'USDC' },
  { symbol: 'SKY',    address: '0x56072C95FAA701256059aa122697B133aDEd9279', via: 'WETH' },
  { symbol: 'MKR',    address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', via: 'WETH' },
  { symbol: '1INCH',  address: '0x111111111117dC0aa78b770fA6A738034120C302', via: 'WETH' },
  { symbol: 'FET',    address: '0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85', via: 'WETH' },
  { symbol: 'ENS',    address: '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72', via: 'WETH' },
  { symbol: 'RENDER', address: '0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24', via: 'WETH' },
  { symbol: 'INJ',    address: '0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30', via: 'WETH' },
  { symbol: 'EIGEN',  address: '0xec53bF9167f50cDEB3Ae105f56099aaaB9061F83', via: 'WETH' },
  { symbol: 'ETHFI',  address: '0xFe0c30065B384F05761f15d0CC899D4F9F9Cc0eB', via: 'WETH' },
  { symbol: 'GRT',    address: '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', via: 'WETH' },
  { symbol: 'GNO',    address: '0x6810e776880C02933D47DB1b9fc05908e5386b96', via: 'WETH' },
  { symbol: 'YFI',    address: '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e', via: 'WETH' },
  { symbol: 'CRV',    address: '0xD533a949740bb3306d119CC777fa900bA034cd52', via: 'WETH' },
];

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
  if (token.toLowerCase() === USDC.toLowerCase()) return 1;
  const quote = via === 'USDC' ? USDC : WETH;
  const quoteDec = via === 'USDC' ? 6 : 18;
  const pools = await client.multicall({ contracts: [100, 500, 3000, 10000].map((fee) => ({ address: V3_FACTORY, abi: V3_FACTORY_ABI, functionName: 'getPool' as const, args: [token, quote, fee] as const })), allowFailure: true });
  const addrs = pools.map((r) => (r.status === 'success' ? (r.result as Address) : null)).filter((a): a is Address => !!a && a !== '0x0000000000000000000000000000000000000000');
  if (addrs.length === 0) throw new Error(`no V3 pool for ${token} via ${via}`);
  const reads = await client.multicall({ contracts: addrs.flatMap((a) => [{ address: a, abi: V3_POOL_ABI, functionName: 'slot0' as const }, { address: a, abi: V3_POOL_ABI, functionName: 'liquidity' as const }]), allowFailure: true });
  let best: { liq: bigint; price: number } | undefined;
  addrs.forEach((_, i) => {
    const s0 = reads[i * 2], liq = reads[i * 2 + 1];
    if (s0.status !== 'success' || liq.status !== 'success') return;
    const sqrt = (s0.result as readonly [bigint, number, number, number, number, number, boolean])[0];
    const token0First = token.toLowerCase() < quote.toLowerCase();
    const p = token0First ? sqrtToPrice(sqrt, decimals, quoteDec) : 1 / sqrtToPrice(sqrt, quoteDec, decimals);
    const L = liq.result as bigint;
    if (!best || L > best.liq) best = { liq: L, price: p };
  });
  const chosen = best as { liq: bigint; price: number } | undefined;
  if (!chosen) throw new Error(`unreadable V3 pools for ${token}`);
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
  const oposUsd = pegOpos;
  const oposPerSide = parseUnits((USD_PER_SIDE / oposUsd).toFixed(0), 18);

  // 2) Per-token plan.
  const decs = await client.multicall({ contracts: TOKENS.map((t) => ({ address: t.address, abi: erc20Abi, functionName: 'decimals' as const })), allowFailure: false });
  const plan: { t: (typeof TOKENS)[number]; dec: number; usd: number; amount: bigint; pair: Address }[] = [];
  for (let i = 0; i < TOKENS.length; i++) {
    const t = TOKENS[i], dec = Number(decs[i]);
    const usd = await v3PriceUsd(t.address, t.via, wethUsd, dec);
    const amount = parseUnits((USD_PER_SIDE / usd).toFixed(Math.min(dec, 8)), dec);
    const pair = existing[i].status === 'success' ? (existing[i].result as Address) : '0x0000000000000000000000000000000000000000';
    plan.push({ t, dec, usd, amount, pair });
  }
  console.log('\nsymbol   price USD        token amount          OPOS amount            pair');
  for (const p of plan) console.log(`${p.t.symbol.padEnd(8)} ${fmt(p.usd, 6).padStart(14)}  ${formatUnits(p.amount, p.dec).padStart(20)}  ${formatUnits(oposPerSide, 18).padStart(22)}  ${p.pair === '0x0000000000000000000000000000000000000000' ? '(new)' : p.pair}`);
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

  // 3c) Approvals to the router, then one addLiquidity per pair.
  await approveIfNeeded(OPOS, V2_ROUTER, totalOpos, 'OPOS to router');
  for (const p of plan) {
    const bal = await client.readContract({ address: p.t.address, abi: erc20Abi, functionName: 'balanceOf', args: [from] });
    const amount = bal < p.amount ? bal : p.amount;
    await approveIfNeeded(p.t.address, V2_ROUTER, amount, `${p.t.symbol} to router`);
    const min = (v: bigint) => (v * BigInt(10_000 - SLIPPAGE_BPS)) / 10_000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_S);
    await tx(`addLiquidity OPOS/${p.t.symbol}`, V2_ROUTER, encodeFunctionData({ abi: ROUTER_ABI, functionName: 'addLiquidity', args: [OPOS, p.t.address, oposPerSide, amount, min(oposPerSide), min(amount), LP_RECIPIENT, deadline] }));
  }
  console.log('\ndone');
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
