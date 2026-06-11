import { encodeAbiParameters, encodePacked, keccak256, toHex, type PublicClient } from 'viem';
import { UNISWAP_V4, V4_DEPLOY_BLOCK, isNativeCurrency, type PoolKey } from './addresses';
import { POSITION_MANAGER_ABI, STATE_VIEW_ABI, POOL_KEY_COMPONENTS, ERC721_TRANSFER_EVENT } from './abis';
import { ERC20_META_ABI } from '../v3/abis';
import { getAmountsForLiquidity } from '../v3/math';
import type { LiquidityPosition } from '@/protocols/types';

const MASK256 = (1n << 256n) - 1n;
const Q128 = 1n << 128n;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('rpc timeout')), ms)),
  ]);
}

/** poolId = keccak256(abi.encode(PoolKey)). */
export function poolIdOf(key: PoolKey): `0x${string}` {
  return keccak256(encodeAbiParameters([{ type: 'tuple', components: POOL_KEY_COMPONENTS }], [key]));
}

/** PoolManager position key for a PositionManager-held tokenId (salt = tokenId). */
function positionKeyOf(tokenId: bigint, tickLower: number, tickUpper: number): `0x${string}` {
  return keccak256(encodePacked(
    ['address', 'int24', 'int24', 'bytes32'],
    [UNISWAP_V4.positionManager, tickLower, tickUpper, toHex(tokenId, { size: 32 })],
  ));
}

/** Unpack the int24 ticks from a packed PositionInfo (poolId|tickUpper|tickLower|flags). */
function unpackTicks(info: bigint): { tickLower: number; tickUpper: number } {
  const toInt24 = (x: bigint) => {
    const v = Number(x & 0xffffffn);
    return v >= 0x800000 ? v - 0x1000000 : v;
  };
  return { tickLower: toInt24(info >> 8n), tickUpper: toInt24(info >> 32n) };
}

/**
 * Read every Uniswap V4 position the owner holds on mainnet, with current
 * token amounts, uncollected fees, and in/out-of-range status. Read-only.
 *
 * The V4 PositionManager is not ERC721Enumerable, so candidate tokenIds come
 * from its Transfer logs (to = owner, from V4's deploy block — topic-indexed,
 * one getLogs call) and are then confirmed via ownerOf. Unlike V3 there is no
 * tokensOwed counter; uncollected fees are computed live from the fee-growth
 * delta: liquidity * (feeGrowthInside_now − feeGrowthInside_last) / 2^128.
 */
export async function fetchV4Positions(
  client: PublicClient,
  owner: `0x${string}`,
): Promise<LiquidityPosition[]> {
  const posm = UNISWAP_V4.positionManager;

  // 1) candidate tokenIds ever transferred to the owner. Public RPCs vary in
  //    how far back they serve logs (and some hang on big ranges), so: full
  //    range with a hard timeout, then a recent ~6-month window as fallback.
  let candidates: bigint[];
  const scan = (fromBlock: bigint) => client.getLogs({
    address: posm,
    event: ERC721_TRANSFER_EVENT,
    args: { to: owner },
    fromBlock,
    toBlock: 'latest',
  });
  try {
    let logs;
    try {
      logs = await withTimeout(scan(V4_DEPLOY_BLOCK), 15_000);
    } catch {
      const head = await withTimeout(client.getBlockNumber(), 5_000);
      logs = await withTimeout(scan(head > 1_300_000n ? head - 1_300_000n : 0n), 10_000);
    }
    candidates = [...new Set(logs.map((l) => l.args.tokenId).filter((x): x is bigint => x !== undefined))];
  } catch {
    return []; // RPC without usable historic-log support — degrade to "no V4 positions"
  }
  if (candidates.length === 0) return [];
  candidates = candidates.slice(-300); // safety cap for extreme wallets

  // 2) keep only tokenIds still owned (drops transfers-away; burns revert)
  const ownerRes = await client.multicall({
    contracts: candidates.map((id) => ({
      address: posm, abi: POSITION_MANAGER_ABI, functionName: 'ownerOf' as const, args: [id] as const,
    })),
    allowFailure: true,
  });
  const tokenIds = candidates.filter((_, i) => {
    const r = ownerRes[i];
    return r.status === 'success' && (r.result as string).toLowerCase() === owner.toLowerCase();
  });
  if (tokenIds.length === 0) return [];

  // 3) pool key + packed range info + liquidity per position
  const infoRes = await client.multicall({
    contracts: tokenIds.flatMap((id) => [
      { address: posm, abi: POSITION_MANAGER_ABI, functionName: 'getPoolAndPositionInfo' as const, args: [id] as const },
      { address: posm, abi: POSITION_MANAGER_ABI, functionName: 'getPositionLiquidity' as const, args: [id] as const },
    ]),
    allowFailure: true,
  });

  type Raw = {
    id: bigint; key: PoolKey; poolId: `0x${string}`;
    tickLower: number; tickUpper: number; liquidity: bigint;
  };
  const raws: Raw[] = [];
  tokenIds.forEach((id, i) => {
    const kr = infoRes[i * 2], lr = infoRes[i * 2 + 1];
    if (kr.status !== 'success' || lr.status !== 'success') return;
    const [rawKey, info] = kr.result as readonly [
      { currency0: `0x${string}`; currency1: `0x${string}`; fee: number; tickSpacing: number; hooks: `0x${string}` },
      bigint,
    ];
    if (info === 0n) return; // EMPTY_POSITION_INFO — burned
    const key: PoolKey = {
      currency0: rawKey.currency0, currency1: rawKey.currency1,
      fee: Number(rawKey.fee), tickSpacing: Number(rawKey.tickSpacing), hooks: rawKey.hooks,
    };
    raws.push({ id, key, poolId: poolIdOf(key), ...unpackTicks(info), liquidity: lr.result as bigint });
  });
  if (raws.length === 0) return [];

  // 4) pool state (price/tick) per unique pool + fee growth per position
  const uniquePoolIds = [...new Set(raws.map((r) => r.poolId))];
  const stateRes = await client.multicall({
    contracts: [
      ...uniquePoolIds.map((pid) => ({
        address: UNISWAP_V4.stateView, abi: STATE_VIEW_ABI, functionName: 'getSlot0' as const, args: [pid] as const,
      })),
      ...raws.flatMap((r) => [
        { address: UNISWAP_V4.stateView, abi: STATE_VIEW_ABI, functionName: 'getFeeGrowthInside' as const, args: [r.poolId, r.tickLower, r.tickUpper] as const },
        { address: UNISWAP_V4.stateView, abi: STATE_VIEW_ABI, functionName: 'getPositionInfo' as const, args: [r.poolId, positionKeyOf(r.id, r.tickLower, r.tickUpper)] as const },
      ]),
    ],
    allowFailure: true,
  });
  const poolState = new Map<string, { sqrtPriceX96: bigint; tick: number }>();
  uniquePoolIds.forEach((pid, i) => {
    const s = stateRes[i];
    if (s.status !== 'success') return;
    const arr = s.result as readonly unknown[];
    poolState.set(pid, { sqrtPriceX96: arr[0] as bigint, tick: Number(arr[1]) });
  });
  const feeBase = uniquePoolIds.length;
  const fees = raws.map((_, i) => {
    const g = stateRes[feeBase + i * 2], p = stateRes[feeBase + i * 2 + 1];
    if (g.status !== 'success' || p.status !== 'success') return { fees0: 0n, fees1: 0n };
    const [fg0, fg1] = g.result as readonly [bigint, bigint];
    const [liq, fg0Last, fg1Last] = p.result as readonly [bigint, bigint, bigint];
    return {
      fees0: (liq * ((fg0 - fg0Last) & MASK256)) / Q128,
      fees1: (liq * ((fg1 - fg1Last) & MASK256)) / Q128,
    };
  });

  // 5) token metadata — native ETH (address 0) is hardcoded, ERC-20s are read
  const tokens = [...new Set(raws.flatMap((r) => [r.key.currency0, r.key.currency1]))]
    .filter((t) => !isNativeCurrency(t));
  const metaRes = await client.multicall({
    contracts: tokens.flatMap((t) => [
      { address: t, abi: ERC20_META_ABI, functionName: 'symbol' as const },
      { address: t, abi: ERC20_META_ABI, functionName: 'decimals' as const },
    ]),
    allowFailure: true,
  });
  const meta = new Map<string, { symbol: string; decimals: number }>();
  tokens.forEach((t, i) => {
    const sym = metaRes[i * 2], dec = metaRes[i * 2 + 1];
    meta.set(t.toLowerCase(), {
      symbol: sym.status === 'success' ? (sym.result as string) : '?',
      decimals: dec.status === 'success' ? Number(dec.result as number) : 18,
    });
  });
  const metaOf = (t: `0x${string}`) =>
    isNativeCurrency(t) ? { symbol: 'ETH', decimals: 18 } : meta.get(t.toLowerCase()) ?? { symbol: '?', decimals: 18 };

  // 6) assemble — drop dust positions with nothing left in them
  return raws.flatMap((r, i): LiquidityPosition[] => {
    const { fees0, fees1 } = fees[i];
    if (r.liquidity === 0n && fees0 === 0n && fees1 === 0n) return [];
    const st = poolState.get(r.poolId);
    const m0 = metaOf(r.key.currency0);
    const m1 = metaOf(r.key.currency1);
    let amount0 = 0n, amount1 = 0n, inRange = false;
    if (st && r.liquidity > 0n) {
      [amount0, amount1] = getAmountsForLiquidity(st.sqrtPriceX96, r.tickLower, r.tickUpper, r.liquidity);
      inRange = st.tick >= r.tickLower && st.tick < r.tickUpper;
    }
    return [{
      protocol: 'uniswap-v4',
      id: r.id,
      token0: r.key.currency0, token1: r.key.currency1,
      symbol0: m0.symbol, symbol1: m1.symbol,
      decimals0: m0.decimals, decimals1: m1.decimals,
      fee: r.key.fee, tickLower: r.tickLower, tickUpper: r.tickUpper,
      liquidity: r.liquidity,
      sqrtPriceX96: st?.sqrtPriceX96 ?? 0n,
      currentTick: st?.tick ?? 0,
      amount0, amount1,
      fees0, fees1,
      inRange,
    }];
  });
}
