import {
  encodeAbiParameters, encodeFunctionData, encodePacked, zeroAddress, type Hex, type PublicClient,
} from 'viem';
import { EMPTY_ZAP_LEG, minWithSlippage, type ZapLeg } from './smartAccount';
import { FEE_TIERS, ROBINHOOD_QUOTER_V2, ROBINHOOD_SWAP_ROUTER_02, ROBINHOOD_WETH } from '@/protocols/dexs/uniswap';

// Funding a managed LP increase with a token that is NOT one of the pool's two
// tokens: the Zap runs two legs, swapping the funding token into token0 and
// token1 by the range's value split. Each leg needs a Uniswap V3 path the
// on-chain route guard accepts (direct, or hopped through WETH) plus fresh
// SwapRouter02 calldata that actually performs the swap.

const FACTORY_ABI = [{ name: 'getPool', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }], outputs: [{ type: 'address' }] }] as const;
const POOL_LIQ_ABI = [{ name: 'liquidity', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint128' }] }] as const;
const QUOTER_MULTIHOP_ABI = [{ name: 'quoteExactInput', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'path', type: 'bytes' }, { name: 'amountIn', type: 'uint256' }], outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'sqrtPriceX96AfterList', type: 'uint160[]' }, { name: 'initializedTicksCrossedList', type: 'uint32[]' }, { name: 'gasEstimate', type: 'uint256' }] }] as const;
const ROUTER_MULTIHOP_ABI = [{ name: 'exactInput', type: 'function', stateMutability: 'payable', inputs: [{ name: 'params', type: 'tuple', components: [{ name: 'path', type: 'bytes' }, { name: 'recipient', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'amountOutMinimum', type: 'uint256' }] }], outputs: [{ name: 'amountOut', type: 'uint256' }] }] as const;
const ROUTER_SINGLE_ABI = [{ name: 'exactInputSingle', type: 'function', stateMutability: 'payable', inputs: [{ name: 'params', type: 'tuple', components: [{ name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'recipient', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'amountOutMinimum', type: 'uint256' }, { name: 'sqrtPriceLimitX96', type: 'uint160' }] }], outputs: [{ name: 'amountOut', type: 'uint256' }] }] as const;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Fee tier of the deepest live pool for a pair, or null when none exists. */
async function bestFeeTier(client: PublicClient, factory: `0x${string}`, a: `0x${string}`, b: `0x${string}`): Promise<number | null> {
  const candidates = await Promise.all(FEE_TIERS.map(async fee => {
    const pool = await client.readContract({ address: factory, abi: FACTORY_ABI, functionName: 'getPool', args: [a, b, fee] }).catch(() => zeroAddress);
    if (pool === zeroAddress) return null;
    const liquidity = await client.readContract({ address: pool, abi: POOL_LIQ_ABI, functionName: 'liquidity' }).catch(() => 0n);
    return liquidity > 0n ? { fee, liquidity } : null;
  }));
  let best: { fee: number; liquidity: bigint } | null = null;
  for (const candidate of candidates) if (candidate && (!best || candidate.liquidity > best.liquidity)) best = candidate;
  return best?.fee ?? null;
}

/**
 * Uniswap V3 packed path tokenIn→tokenOut (direct, or hopped through WETH).
 * `singleFee` is set only for a direct one-hop route, so the caller can use the
 * cheaper `exactInputSingle` the swap adapter is most likely to whitelist.
 */
async function protectedPath(client: PublicClient, factory: `0x${string}`, tokenIn: `0x${string}`, tokenOut: `0x${string}`): Promise<{ path: Hex; singleFee: number | null } | null> {
  const weth = ROBINHOOD_WETH;
  const direct = await bestFeeTier(client, factory, tokenIn, tokenOut);
  if (direct !== null) return { path: encodePacked(['address', 'uint24', 'address'], [tokenIn, direct, tokenOut]), singleFee: direct };
  if (same(tokenIn, weth) || same(tokenOut, weth)) return null;
  const [first, second] = await Promise.all([bestFeeTier(client, factory, tokenIn, weth), bestFeeTier(client, factory, weth, tokenOut)]);
  if (first === null || second === null) return null;
  return { path: encodePacked(['address', 'uint24', 'address', 'uint24', 'address'], [tokenIn, first, weth, second, tokenOut]), singleFee: null };
}

async function quoteExactInput(client: PublicClient, path: Hex, amountIn: bigint): Promise<bigint> {
  const quote = await client.simulateContract({ address: ROBINHOOD_QUOTER_V2, abi: QUOTER_MULTIHOP_ABI, functionName: 'quoteExactInput', args: [path, amountIn] });
  return (quote.result as readonly [bigint, readonly bigint[], readonly number[], bigint])[0];
}

export interface AnyTokenLegs {
  leg0: ZapLeg;
  leg1: ZapLeg;
  fresh0: Hex;
  fresh1: Hex;
  expected0: bigint;
  expected1: bigint;
}

/**
 * Split `fundingAmount` of `fundingToken` by the range's value ratio and build
 * both swap legs (funding → token0, funding → token1). Throws with a readable
 * message when either side has no protected route.
 */
export async function buildAnyTokenLegs(params: {
  client: PublicClient;
  factory: `0x${string}`;
  adapter: `0x${string}`;
  fundingToken: `0x${string}`;
  fundingSymbol: string;
  fundingAmount: bigint;
  token0: `0x${string}`;
  token1: `0x${string}`;
  symbol0: string;
  symbol1: string;
  value0Bps: number;
  slippageBps: number;
}): Promise<AnyTokenLegs> {
  const { client, factory, adapter, fundingToken, fundingSymbol, fundingAmount, token0, token1, symbol0, symbol1, value0Bps, slippageBps } = params;
  const amount0In = fundingAmount * BigInt(Math.max(0, Math.min(10_000, value0Bps))) / 10_000n;
  const amount1In = fundingAmount - amount0In;

  const buildLeg = async (tokenOut: `0x${string}`, tokenOutSymbol: string, amountIn: bigint): Promise<{ leg: ZapLeg; fresh: Hex; expectedOut: bigint }> => {
    if (amountIn === 0n) return { leg: { ...EMPTY_ZAP_LEG }, fresh: '0x', expectedOut: 0n };
    const route = await protectedPath(client, factory, fundingToken, tokenOut);
    if (!route) throw new Error(`No protected route from ${fundingSymbol} to ${tokenOutSymbol}. Swap it to WETH first, then add.`);
    const expectedOut = await quoteExactInput(client, route.path, amountIn);
    if (expectedOut === 0n) throw new Error(`The swap from ${fundingSymbol} to ${tokenOutSymbol} quoted zero`);
    const minimumOut = minWithSlippage(expectedOut, slippageBps);
    const routerCalldata = route.singleFee !== null
      ? encodeFunctionData({ abi: ROUTER_SINGLE_ABI, functionName: 'exactInputSingle', args: [{ tokenIn: fundingToken, tokenOut, fee: route.singleFee, recipient: adapter, amountIn, amountOutMinimum: minimumOut, sqrtPriceLimitX96: 0n }] })
      : encodeFunctionData({ abi: ROUTER_MULTIHOP_ABI, functionName: 'exactInput', args: [{ path: route.path, recipient: adapter, amountIn, amountOutMinimum: minimumOut }] });
    const fresh = encodeAbiParameters([{ type: 'address' }, { type: 'bytes' }], [ROBINHOOD_SWAP_ROUTER_02, routerCalldata]);
    return { leg: { tokenOut, amountIn, quotedMinimumOut: minimumOut, path: route.path }, fresh, expectedOut };
  };

  const [l0, l1] = await Promise.all([buildLeg(token0, symbol0, amount0In), buildLeg(token1, symbol1, amount1In)]);
  return { leg0: l0.leg, leg1: l1.leg, fresh0: l0.fresh, fresh1: l1.fresh, expected0: l0.expectedOut, expected1: l1.expectedOut };
}
