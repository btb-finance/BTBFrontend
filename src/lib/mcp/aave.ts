import { encodeFunctionData, erc20Abi, formatUnits, maxUint256, parseUnits, type PublicClient } from 'viem';
import { getChainClient } from '../chainClient';
import { simulate, txOut, type TxOut } from './build';
import { findProtocol } from './registry';
import { findToken, tokenChainId } from './tokens';

/**
 * Lending on Aave V3 for agents: supply and withdraw built as steps to sign, with the live rate, the wallet's
 * position and health factor read from Aave's own contracts. Unlike a generic build_tx call, the approval is added
 * only when needed, for the exact amount, and the contracts come from the BTB registry.
 */

type Addr = `0x${string}`;

const POOL_ABI = [
  {
    type: 'function', name: 'getReserveData', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }],
    outputs: [{
      type: 'tuple', components: [
        { name: 'configuration', type: 'uint256' }, { name: 'liquidityIndex', type: 'uint128' }, { name: 'currentLiquidityRate', type: 'uint128' },
        { name: 'variableBorrowIndex', type: 'uint128' }, { name: 'currentVariableBorrowRate', type: 'uint128' }, { name: 'currentStableBorrowRate', type: 'uint128' },
        { name: 'lastUpdateTimestamp', type: 'uint40' }, { name: 'id', type: 'uint16' }, { name: 'aTokenAddress', type: 'address' },
        { name: 'stableDebtTokenAddress', type: 'address' }, { name: 'variableDebtTokenAddress', type: 'address' },
        { name: 'interestRateStrategyAddress', type: 'address' }, { name: 'accruedToTreasury', type: 'uint128' },
        { name: 'unbacked', type: 'uint128' }, { name: 'isolationModeTotalDebt', type: 'uint128' },
      ],
    }],
  },
  {
    type: 'function', name: 'getUserAccountData', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'totalCollateralBase', type: 'uint256' }, { name: 'totalDebtBase', type: 'uint256' }, { name: 'availableBorrowsBase', type: 'uint256' },
      { name: 'currentLiquidationThreshold', type: 'uint256' }, { name: 'ltv', type: 'uint256' }, { name: 'healthFactor', type: 'uint256' },
    ],
  },
  { type: 'function', name: 'supply', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'onBehalfOf', type: 'address' }, { name: 'referralCode', type: 'uint16' }], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'to', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

const SECONDS_PER_YEAR = 31_536_000;
/** Aave rates are yearly, in ray (1e27), compounded every second. */
const apyPct = (rayRate: bigint) => Math.round(((1 + Number(rayRate) / 1e27 / SECONDS_PER_YEAR) ** SECONDS_PER_YEAR - 1) * 10_000) / 100;

/** The Aave V3 Pool on a chain, from the registry (the main market when a chain has more than one). */
function poolFor(chainId: number): Addr {
  const entry = findProtocol('aave-v3');
  const pool = entry?.contracts.find((c) => c.chainId === chainId && c.role === 'pool');
  if (!pool) throw new Error(`Aave V3 is not in the BTB registry on chain ${chainId}. Chains: Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, BNB Chain.`);
  return pool.address as Addr;
}

async function resolveToken(chainId: number, token: string): Promise<{ address: Addr; symbol: string; decimals: number }> {
  if (/^(eth|native)$/i.test(token)) {
    throw new Error('Aave lends the wrapped coin: use WETH (or WBNB, WPOL), swapping ETH to it first with build_swap if needed.');
  }
  const found = await findToken(token, chainId);
  const t = found.tokens[0] as { address: string; symbol?: string; decimals?: number } | undefined;
  if (!t || !/^0x[0-9a-fA-F]{40}$/.test(t.address)) throw new Error(`No token "${token}" on chain ${chainId}. Pass its address.`);
  return { address: t.address as Addr, symbol: t.symbol ?? token, decimals: t.decimals ?? 18 };
}

async function reserve(client: PublicClient, pool: Addr, asset: Addr) {
  const r = await client.readContract({ address: pool, abi: POOL_ABI, functionName: 'getReserveData', args: [asset] });
  if (r.aTokenAddress === '0x0000000000000000000000000000000000000000') throw new Error('This token is not listed on Aave V3 on this chain. lending_rates shows what is.');
  const cfg = r.configuration;
  const bit = (n: number) => ((cfg >> BigInt(n)) & 1n) === 1n;
  return { aToken: r.aTokenAddress as Addr, supplyApyPct: apyPct(r.currentLiquidityRate), borrowApyPct: apyPct(r.currentVariableBorrowRate), active: bit(56), frozen: bit(57), paused: bit(60) };
}

async function account(client: PublicClient, pool: Addr, wallet: Addr) {
  const [, debt, , , , hf] = await client.readContract({ address: pool, abi: POOL_ABI, functionName: 'getUserAccountData', args: [wallet] });
  return { hasDebt: debt > 0n, healthFactor: debt > 0n ? Math.round(Number(formatUnits(hf, 18)) * 100) / 100 : null };
}

interface Built {
  chainId: number; protocol: 'Aave V3'; action: 'lend' | 'withdraw'; pool: Addr;
  token: { address: Addr; symbol: string; decimals: number }; amount: string;
  supplyApyPct: number; position: Record<string, unknown>; simulation: { status: string; reason?: string }; transactions: TxOut[]; warnings: string[];
}

export async function buildLend(a: { chain: string; token: string; amount: string; wallet: string }): Promise<Built> {
  const chainId = tokenChainId(a.chain);
  if (!chainId) throw new Error(`Unknown chain "${a.chain}".`);
  if (!/^0x[0-9a-fA-F]{40}$/.test(a.wallet)) throw new Error('wallet must be a 0x address.');
  const wallet = a.wallet as Addr;
  const client = getChainClient(chainId)!;
  const pool = poolFor(chainId);
  const token = await resolveToken(chainId, a.token);
  const [res, balance, allowance, acct] = await Promise.all([
    reserve(client, pool, token.address),
    client.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] }),
    client.readContract({ address: token.address, abi: erc20Abi, functionName: 'allowance', args: [wallet, pool] }),
    account(client, pool, wallet),
  ]);
  if (!res.active || res.frozen || res.paused) throw new Error(`Aave is not taking new ${token.symbol} deposits on this chain right now (${res.paused ? 'paused' : res.frozen ? 'frozen' : 'inactive'}).`);
  const amount = a.amount === 'max' ? balance : parseUnits(a.amount, token.decimals);
  if (amount <= 0n) throw new Error(`The wallet holds no ${token.symbol} on this chain.`);
  const calls: { to: Addr; data: `0x${string}`; label: string }[] = [];
  const human = formatUnits(amount, token.decimals);
  if (allowance < amount) {
    calls.push({ to: token.address, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [pool, amount] }), label: `Approve exactly ${human} ${token.symbol} for Aave` });
  }
  const supply = { to: pool, data: encodeFunctionData({ abi: POOL_ABI, functionName: 'supply', args: [token.address, amount, wallet, 0] }), label: `Lend ${human} ${token.symbol} on Aave` };
  calls.push(supply);
  const sim = balance < amount
    ? { status: 'skipped', reason: `The wallet holds ${formatUnits(balance, token.decimals)} ${token.symbol}, less than ${human}.` }
    : await simulate(client, wallet, supply, calls.length > 1 ? 'Runs once the approval in step 1 is confirmed.' : null);
  const yearly = Number(human) * res.supplyApyPct / 100;
  return {
    chainId, protocol: 'Aave V3', action: 'lend', pool, token, amount: human, supplyApyPct: res.supplyApyPct,
    position: { healthFactor: acct.healthFactor, hasDebt: acct.hasDebt, earnPerYearAtCurrentRate: `${yearly.toPrecision(3)} ${token.symbol}` },
    simulation: sim, transactions: txOut(calls, chainId, wallet),
    warnings: balance < amount ? [`Not enough ${token.symbol}: the wallet holds ${formatUnits(balance, token.decimals)}.`] : [],
  };
}

export async function buildWithdraw(a: { chain: string; token: string; amount: string; wallet: string }): Promise<Built> {
  const chainId = tokenChainId(a.chain);
  if (!chainId) throw new Error(`Unknown chain "${a.chain}".`);
  if (!/^0x[0-9a-fA-F]{40}$/.test(a.wallet)) throw new Error('wallet must be a 0x address.');
  const wallet = a.wallet as Addr;
  const client = getChainClient(chainId)!;
  const pool = poolFor(chainId);
  const token = await resolveToken(chainId, a.token);
  const res = await reserve(client, pool, token.address);
  const [supplied, liquidity, acct] = await Promise.all([
    client.readContract({ address: res.aToken, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] }),
    client.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [res.aToken] }),
    account(client, pool, wallet),
  ]);
  if (supplied === 0n) throw new Error(`This wallet has no ${token.symbol} lent on Aave on this chain.`);
  const all = a.amount === 'max';
  const amount = all ? supplied : parseUnits(a.amount, token.decimals);
  const human = formatUnits(amount, token.decimals);
  const call = {
    to: pool,
    // "max" withdraws everything including interest earned up to the block it lands in.
    data: encodeFunctionData({ abi: POOL_ABI, functionName: 'withdraw', args: [token.address, all ? maxUint256 : amount, wallet] }),
    label: all ? `Withdraw all ${token.symbol} from Aave (about ${human})` : `Withdraw ${human} ${token.symbol} from Aave`,
  };
  const sim = await simulate(client, wallet, call, null);
  const warnings: string[] = [];
  if (amount > liquidity) warnings.push(`Aave holds only ${formatUnits(liquidity, token.decimals)} ${token.symbol} right now (the rest is lent out); withdraw less, or wait for repayments.`);
  if (acct.hasDebt) warnings.push(`This wallet has borrowed on Aave (health factor ${acct.healthFactor}). Withdrawing collateral lowers it; below 1 the position can be liquidated.`);
  return {
    chainId, protocol: 'Aave V3', action: 'withdraw', pool, token, amount: human, supplyApyPct: res.supplyApyPct,
    position: { suppliedNow: formatUnits(supplied, token.decimals), withdrawableNow: formatUnits(liquidity < supplied ? liquidity : supplied, token.decimals), healthFactor: acct.healthFactor, hasDebt: acct.hasDebt },
    simulation: sim, transactions: txOut([call], chainId, wallet), warnings,
  };
}
