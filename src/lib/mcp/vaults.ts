import { encodeFunctionData, erc20Abi, erc4626Abi, formatUnits, parseUnits } from 'viem';
import { getChainClient } from '../chainClient';
import { simulate, txOut } from './build';
import { tokenChainId } from './tokens';

/**
 * Deposits into and withdrawals from yield vaults (ERC-4626: Morpho V1 and V2, and the same standard elsewhere), built
 * as one set of steps with a known ABI, so no contract lookup is needed. The vault must be one Morpho's API knows, so
 * an agent can never be pointed at a look-alike contract.
 */

type Addr = `0x${string}`;

async function morphoVault(chainId: number, vault: string): Promise<{ name: string; version: string } | null> {
  for (const version of ['v2', 'v1']) {
    const r = await fetch(`https://api.morpho.org/v0/vaults-${version}/${chainId}:${vault}`, { signal: AbortSignal.timeout(8_000) }).catch(() => null);
    if (r?.ok) {
      const b = await r.json().catch(() => null) as { data?: { name?: string } } | null;
      if (b?.data) return { name: b.data.name ?? 'Morpho vault', version };
    }
  }
  return null;
}

async function open(a: { chain: string; vault: string; wallet: string }) {
  const chainId = tokenChainId(a.chain);
  if (!chainId) throw new Error(`Unknown chain "${a.chain}".`);
  if (!/^0x[0-9a-fA-F]{40}$/.test(a.vault)) throw new Error('vault must be the vault address (compare_yield gives it).');
  if (!/^0x[0-9a-fA-F]{40}$/.test(a.wallet)) throw new Error('wallet must be a 0x address.');
  const vault = a.vault.toLowerCase() as Addr;
  const known = await morphoVault(chainId, vault);
  if (!known) throw new Error('This is not a vault Morpho knows on this chain. Use compare_yield for vault addresses, or build_tx for other contracts.');
  const client = getChainClient(chainId)!;
  const [asset, shareDecimals] = await Promise.all([
    client.readContract({ address: vault, abi: erc4626Abi, functionName: 'asset' }),
    client.readContract({ address: vault, abi: erc20Abi, functionName: 'decimals' }),
  ]);
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address: asset, abi: erc20Abi, functionName: 'symbol' }).catch(() => 'tokens'),
    client.readContract({ address: asset, abi: erc20Abi, functionName: 'decimals' }),
  ]);
  return { chainId, client, vault, wallet: a.wallet as Addr, asset, symbol: String(symbol), decimals: Number(decimals), shareDecimals: Number(shareDecimals), name: known.name, version: known.version };
}

export async function buildVaultDeposit(a: { chain: string; vault: string; amount: string; wallet: string }) {
  const v = await open(a);
  const { client, vault, wallet, asset } = v;
  const [balance, allowance, maxDeposit] = await Promise.all([
    client.readContract({ address: asset, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] }),
    client.readContract({ address: asset, abi: erc20Abi, functionName: 'allowance', args: [wallet, vault] }),
    client.readContract({ address: vault, abi: erc4626Abi, functionName: 'maxDeposit', args: [wallet] }).catch(() => null),
  ]);
  const amount = a.amount === 'max' ? balance : parseUnits(a.amount, v.decimals);
  if (amount <= 0n) throw new Error(`The wallet holds no ${v.symbol} on this chain.`);
  // Morpho V2 vaults always report maxDeposit 0 (they check caps and gates inside deposit): only V1's answer means anything.
  if (v.version === 'v1' && maxDeposit === 0n) throw new Error(`${v.name} is not taking deposits from this wallet right now (it may be full or gated).`);
  const shares = await client.readContract({ address: vault, abi: erc4626Abi, functionName: 'previewDeposit', args: [amount] });
  const human = formatUnits(amount, v.decimals);
  const calls: { to: Addr; data: `0x${string}`; label: string }[] = [];
  if (allowance < amount) {
    calls.push({ to: asset, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [vault, amount] }), label: `Approve exactly ${human} ${v.symbol} for ${v.name}` });
  }
  const deposit = { to: vault, data: encodeFunctionData({ abi: erc4626Abi, functionName: 'deposit', args: [amount, wallet] }), label: `Deposit ${human} ${v.symbol} into ${v.name}` };
  calls.push(deposit);
  const sim = balance < amount
    ? { status: 'skipped' as const, reason: `The wallet holds ${formatUnits(balance, v.decimals)} ${v.symbol}, less than ${human}.` }
    : await simulate(client, wallet, deposit, calls.length > 1 ? 'Runs once the approval in step 1 is confirmed.' : null);
  return {
    chainId: v.chainId, wallet, vault, vaultName: v.name, morphoVersion: v.version, token: { address: asset, symbol: v.symbol },
    deposit: human, sharesAbout: formatUnits(shares, v.shareDecimals),
    simulation: sim, transactions: txOut(calls, v.chainId, wallet),
    warnings: balance < amount ? [`Not enough ${v.symbol}: the wallet holds ${formatUnits(balance, v.decimals)}.`] : [],
    notes: ['The shares grow in value as the vault earns; withdraw any time with build_vault_withdraw (subject to the vault having liquidity).', 'Vaults carry smart-contract and curator risk. Not financial advice.'],
  };
}

export async function buildVaultWithdraw(a: { chain: string; vault: string; amount: string; wallet: string }) {
  const v = await open(a);
  const { client, vault, wallet } = v;
  const [shares, maxWithdraw] = await Promise.all([
    client.readContract({ address: vault, abi: erc4626Abi, functionName: 'balanceOf', args: [wallet] }),
    client.readContract({ address: vault, abi: erc4626Abi, functionName: 'maxWithdraw', args: [wallet] }).catch(() => null),
  ]);
  if (shares === 0n) throw new Error(`This wallet has nothing in ${v.name}.`);
  const value = await client.readContract({ address: vault, abi: erc4626Abi, functionName: 'convertToAssets', args: [shares] });
  const all = a.amount === 'max';
  const amount = all ? value : parseUnits(a.amount, v.decimals);
  const human = formatUnits(amount, v.decimals);
  // "max" redeems every share, so nothing is left behind as dust; an amount withdraws exactly that much.
  const call = all
    ? { to: vault, data: encodeFunctionData({ abi: erc4626Abi, functionName: 'redeem', args: [shares, wallet, wallet] }), label: `Withdraw everything from ${v.name} (about ${human} ${v.symbol})` }
    : { to: vault, data: encodeFunctionData({ abi: erc4626Abi, functionName: 'withdraw', args: [amount, wallet, wallet] }), label: `Withdraw ${human} ${v.symbol} from ${v.name}` };
  const sim = await simulate(client, wallet, call, null);
  // Morpho V2 vaults always report maxWithdraw 0 (liquidity is checked inside withdraw): the dry run decides there.
  const withdrawable = v.version === 'v1' && maxWithdraw != null ? maxWithdraw : null;
  return {
    chainId: v.chainId, wallet, vault, vaultName: v.name, token: { address: v.asset, symbol: v.symbol },
    withdraw: human,
    position: { worthNow: formatUnits(value, v.decimals), withdrawableNow: withdrawable == null ? 'see the dry run' : formatUnits(withdrawable, v.decimals) },
    simulation: sim, transactions: txOut([call], v.chainId, wallet),
    warnings: withdrawable != null && amount > withdrawable ? [`Only ${formatUnits(withdrawable, v.decimals)} ${v.symbol} can be withdrawn right now (the rest is lent out). Withdraw less, or wait.`] : [],
  };
}
