import {
  encodeAbiParameters, encodePacked, isAddress, isHex, zeroAddress,
  type Address, type Hex, type PublicClient,
} from 'viem';
import { buildKyberTx, getKyberQuote } from './kyberswap';

const FACTORY_ABI = [{
  name: 'getPool', type: 'function', stateMutability: 'view',
  inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }], outputs: [{ type: 'address' }],
}] as const;
const POOL_LIQUIDITY_ABI = [{ name: 'liquidity', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint128' }] }] as const;
const ADAPTER_GUARD_ABI = [
  { name: 'allowedRouter', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'allowedSelector', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'bytes4' }], outputs: [{ type: 'bool' }] },
] as const;

const FEES = [100, 500, 3_000, 10_000] as const;

type Hop = { tokenIn: Address; tokenOut: Address; fee: number; liquidity: bigint };

async function liquidHops(client: PublicClient, factory: Address, tokenIn: Address, tokenOut: Address): Promise<Hop[]> {
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) return [];
  const pools = await Promise.all(FEES.map(async (fee) => {
    const pool = await client.readContract({ address: factory, abi: FACTORY_ABI, functionName: 'getPool', args: [tokenIn, tokenOut, fee] }).catch(() => zeroAddress);
    if (pool === zeroAddress) return null;
    const liquidity = await client.readContract({ address: pool, abi: POOL_LIQUIDITY_ABI, functionName: 'liquidity' }).catch(() => 0n);
    return liquidity > 0n ? { tokenIn, tokenOut, fee, liquidity } : null;
  }));
  const result: Hop[] = [];
  for (const value of pools) if (value) result.push(value);
  return result.sort((a, b) => a.liquidity > b.liquidity ? -1 : 1);
}

/** A Uniswap V3 path used only as an on-chain TWAP reference. Actual execution may use a curated aggregator. */
export async function protectedV3Path(
  client: PublicClient,
  factory: Address,
  tokenIn: Address,
  tokenOut: Address,
  bridge: Address,
): Promise<Hex> {
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) return '0x';
  const direct = await liquidHops(client, factory, tokenIn, tokenOut);
  if (direct[0]) return encodePacked(['address', 'uint24', 'address'], [tokenIn, direct[0].fee, tokenOut]);
  if (tokenIn.toLowerCase() === bridge.toLowerCase() || tokenOut.toLowerCase() === bridge.toLowerCase()) {
    throw new Error('No liquid Uniswap V3 price route exists for this payout token.');
  }
  const [first, second] = await Promise.all([
    liquidHops(client, factory, tokenIn, bridge),
    liquidHops(client, factory, bridge, tokenOut),
  ]);
  if (!first[0] || !second[0]) throw new Error('No protected V3 route exists through WETH for this payout token.');
  return encodePacked(
    ['address', 'uint24', 'address', 'uint24', 'address'],
    [tokenIn, first[0].fee, bridge, second[0].fee, tokenOut],
  );
}

export type ProtectedSwap = { expectedOut: bigint; minimumOut: bigint; swapData: Hex };

export async function buildProtectedKyberSwap(args: {
  client: PublicClient;
  chainId: number;
  adapter: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  outputDecimals: number;
  slippageBps: number;
}): Promise<ProtectedSwap> {
  const { client, chainId, adapter, tokenIn, tokenOut, amountIn, outputDecimals, slippageBps } = args;
  if (amountIn === 0n || tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
    return { expectedOut: amountIn, minimumOut: amountIn, swapData: '0x' };
  }
  const quote = await getKyberQuote(tokenIn, tokenOut, amountIn.toString(), outputDecimals, chainId);
  const expectedOut = BigInt(quote.amountOut || '0');
  if (expectedOut === 0n || !isAddress(quote.routerAddress)) throw new Error('No executable payout route was returned.');
  const built = await buildKyberTx(quote.routeSummary, quote.routerAddress, adapter, adapter, slippageBps, chainId);
  if (!isAddress(built.to) || built.to.toLowerCase() !== quote.routerAddress.toLowerCase() || !isHex(built.data) || built.data.length < 10 || BigInt(built.value || '0') !== 0n) {
    throw new Error('The payout router returned unsafe transaction data.');
  }
  const selector = built.data.slice(0, 10) as Hex;
  const [routerAllowed, selectorAllowed] = await Promise.all([
    client.readContract({ address: adapter, abi: ADAPTER_GUARD_ABI, functionName: 'allowedRouter', args: [built.to] }).catch(() => false),
    client.readContract({ address: adapter, abi: ADAPTER_GUARD_ABI, functionName: 'allowedSelector', args: [built.to, selector] }).catch(() => false),
  ]);
  if (!routerAllowed || !selectorAllowed) throw new Error('This payout route is not approved by the smart-account adapter.');
  return {
    expectedOut,
    minimumOut: expectedOut * BigInt(10_000 - slippageBps) / 10_000n,
    swapData: encodeAbiParameters([{ type: 'address' }, { type: 'bytes' }], [built.to, built.data]),
  };
}
