import { decodeFunctionResult, encodeFunctionData, maxUint256, parseEther, type AbiFunction, type AbiParameter } from 'viem';
import { api } from '../../../convex/_generated/api';
import { getChainClient } from '../chainClient';
import { resolveAbi, type AbiFn, type ResolvedAbi } from '../abi/resolve';
import { chainIdFor, simulate, txOut } from './build';
import { convex } from './data';

// Any contract, any function: the generic layer of the BTB connector. get_abi shows what a contract can do,
// read_contract calls a read function, build_tx encodes any function into an unsigned transaction with a dry run.

type Addr = `0x${string}`;
const isAddr = (s: string): s is Addr => /^0x[0-9a-fA-F]{40}$/.test(s);

// ---- ABI lookup: this instance's memory, then the Convex store (which resolves on a miss), then a local resolve ----

const memo = new Map<string, { at: number; abi: Promise<ResolvedAbi> }>();
const MEMO_MS = 10 * 60_000;

async function viaConvex(chainId: number, address: string): Promise<ResolvedAbi> {
  const json = await Promise.race([
    convex().action(api.abisActions.resolve, { chainId, address }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('ABI store timeout')), 15_000)),
  ]);
  return JSON.parse(json) as ResolvedAbi;
}

export function abiFor(chainId: number, address: string): Promise<ResolvedAbi> {
  const key = `${chainId}:${address.toLowerCase()}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.abi;
  // The store is the shared copy; if it is unreachable (or not deployed yet) resolve here so the tool still answers.
  const abi = viaConvex(chainId, address).catch(() => resolveAbi(chainId, address));
  memo.set(key, { at: Date.now(), abi });
  abi.catch(() => { if (memo.get(key)?.abi === abi) memo.delete(key); });
  return abi;
}

export function target(chain: string, address: string) {
  const chainId = chainIdFor(chain);
  if (!chainId) throw new Error(`BTB has no RPC for chain "${chain}". Use a chain id or a name such as ethereum, base, arbitrum, bnb.`);
  if (!isAddr(address)) throw new Error('address must be a 0x contract address.');
  // Lowercase: viem rejects a mixed-case address whose checksum is wrong, and agents often paste those.
  return { chainId, address: address.toLowerCase() as Addr };
}

// ---- get_abi ----

export async function abiSummary(chain: string, address: string, o: { kind?: 'read' | 'write' | 'all'; search?: string; full?: boolean }) {
  const t = target(chain, address);
  const r = await abiFor(t.chainId, t.address);
  if (!r.hasCode) return { chainId: t.chainId, address: t.address, hasCode: false, note: 'No contract is deployed at this address on this chain (it may be a wallet, or the wrong chain).' };
  const q = o.search?.toLowerCase();
  const fns = r.functions
    .filter((f) => !o.kind || o.kind === 'all' || f.kind === o.kind)
    .filter((f) => !q || (f.signature ?? f.selector).toLowerCase().includes(q));
  return {
    chainId: r.chainId, address: r.address,
    abiFrom: r.abiAddress === r.address ? 'this contract' : `implementation ${r.abiAddress}`,
    proxy: r.proxies.length ? r.proxies : null,
    source: r.verified ? 'verified source (Sourcify)' : 'decoded from bytecode: names from public signature databases, read/write and outputs are guesses',
    counts: { read: r.functions.filter((f) => f.kind === 'read').length, write: r.functions.filter((f) => f.kind === 'write').length },
    functions: fns.slice(0, 200).map((f) => ({
      signature: f.signature ?? `(unknown ${f.selector})`, selector: f.selector, kind: f.kind, stateMutability: f.stateMutability,
      inputs: f.inputs.map((i) => `${i.type}${i.name ? ` ${i.name}` : ''}`),
      outputs: f.outputs ? f.outputs.map((x) => `${x.type}${x.name ? ` ${x.name}` : ''}`) : 'unknown',
      ...(f.flags.length ? { flags: f.flags } : {}),
    })),
    truncated: fns.length > 200 ? `${fns.length - 200} more: narrow with search or kind.` : undefined,
    abi: o.full ? r.abi : undefined,
    flagsMean: {
      'admin-likely': 'Named like an owner/role-only function; it will likely revert for other wallets.',
      'arbitrary-call': 'Runs calls or code the caller passes in. Treat with care.',
      guessed: 'From bytecode, not verified source.',
    },
    resolvedAt: new Date(r.resolvedAt).toISOString(),
  };
}

// ---- picking a function and turning JSON arguments into viem values ----

function pick(r: ResolvedAbi, fn: string, argCount: number): { item: AbiFunction; info: AbiFn } {
  const want = fn.trim();
  const sel = /^0x[0-9a-fA-F]{8}$/.test(want) ? want.toLowerCase() : null;
  const bySig = want.includes('(') ? want.replace(/\s+/g, '') : null;
  const idx = r.functions
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => (sel ? f.selector.toLowerCase() === sel : bySig ? f.signature === bySig : f.name === want));
  if (!idx.length) throw new Error(`No function "${fn}" in this contract's ABI. Use get_abi to list them.`);
  const fit = idx.filter(({ f }) => f.inputs.length === argCount);
  const chosen = (fit.length ? fit : idx);
  if (chosen.length > 1) throw new Error(`"${fn}" is overloaded: pass the full signature, one of ${chosen.map(({ f }) => f.signature).join(', ')}.`);
  const { f, i } = chosen[0];
  if (!f.signature) throw new Error(`Function ${f.selector} has no known signature, so its arguments cannot be encoded.`);
  return { item: r.abi[i], info: f };
}

function coerce(p: AbiParameter, v: unknown): unknown {
  const t = p.type;
  const arr = t.match(/^(.*)\[(\d*)\]$/);
  if (arr) {
    if (!Array.isArray(v)) throw new Error(`${p.name || t}: expected an array.`);
    const inner = { ...p, type: arr[1] } as AbiParameter;
    return v.map((x) => coerce(inner, x));
  }
  if (t === 'tuple') {
    const comps = (p as AbiParameter & { components: readonly AbiParameter[] }).components;
    if (Array.isArray(v)) return comps.map((c, i) => coerce(c, v[i]));
    if (v && typeof v === 'object') return Object.fromEntries(comps.map((c) => [c.name, coerce(c, (v as Record<string, unknown>)[c.name ?? ''])]));
    throw new Error(`${p.name || 'tuple'}: expected an object or an array.`);
  }
  if (/^u?int\d*$/.test(t)) {
    if (v === 'max' || v === 'MAX') return maxUint256;
    if (typeof v === 'number' && !Number.isSafeInteger(v)) throw new Error(`${p.name || t}: pass large numbers as strings in base units.`);
    try { return BigInt(v as string | number); } catch { throw new Error(`${p.name || t}: "${String(v)}" is not an integer in base units.`); }
  }
  if (t === 'bool') return v === true || v === 'true' || v === 1 || v === '1';
  if (t === 'address') {
    if (typeof v !== 'string' || !isAddr(v)) throw new Error(`${p.name || 'address'}: "${String(v)}" is not a 0x address.`);
    return v;
  }
  if (/^bytes\d*$/.test(t)) {
    if (typeof v !== 'string' || !/^0x[0-9a-fA-F]*$/.test(v)) throw new Error(`${p.name || t}: expected 0x hex.`);
    return v;
  }
  return v;
}

const coerceArgs = (item: AbiFunction, args: unknown[]) => {
  if (args.length !== item.inputs.length) throw new Error(`${item.name} takes ${item.inputs.length} argument(s): ${item.inputs.map((i) => `${i.type} ${i.name ?? ''}`.trim()).join(', ') || 'none'}.`);
  return item.inputs.map((p, i) => coerce(p, args[i]));
};

/** bigint → string, recursively, so results survive JSON. */
const plain = (v: unknown): unknown =>
  typeof v === 'bigint' ? v.toString() : Array.isArray(v) ? v.map(plain)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)])) : v;

// ---- read_contract ----

export async function readContract(chain: string, address: string, fn: string, args: unknown[]) {
  const t = target(chain, address);
  const r = await abiFor(t.chainId, t.address);
  const { item, info } = pick(r, fn, args.length);
  if (info.kind === 'write' && r.verified) throw new Error(`${info.signature} changes state; it cannot be read. Use build_tx to prepare it.`);
  const client = getChainClient(t.chainId)!;
  const data = encodeFunctionData({ abi: [item], functionName: item.name, args: coerceArgs(item, args) });
  const res = await client.call({ to: t.address, data });
  const raw = res.data ?? '0x';
  let result: unknown = null;
  if (info.outputs && info.outputs.length) {
    try { result = plain(decodeFunctionResult({ abi: [item], functionName: item.name, data: raw })); } catch { result = null; }
  }
  return {
    chainId: t.chainId, contract: t.address, function: info.signature, args,
    result, raw: result === null ? raw : undefined,
    note: result === null ? 'Output types are unknown (ABI decoded from bytecode): raw return data shown.' : 'Integers are in base units (divide by 10^decimals).',
  };
}

// ---- build_tx ----

export async function buildTx(a: { chain: string; address: string; fn: string; args: unknown[]; wallet: string; valueEth?: string }) {
  const t = target(a.chain, a.address);
  if (!isAddr(a.wallet)) throw new Error('wallet must be a 0x address.');
  const wallet = a.wallet as Addr;
  const r = await abiFor(t.chainId, t.address);
  const { item, info } = pick(r, a.fn, a.args.length);
  const values = coerceArgs(item, a.args);
  const data = encodeFunctionData({ abi: [item], functionName: item.name, args: values });
  const value = a.valueEth ? parseEther(a.valueEth) : 0n;
  if (value > 0n && info.stateMutability !== 'payable' && r.verified) throw new Error(`${info.signature} is not payable: it cannot take ETH.`);

  const warnings: string[] = ['Generic call: BTB encodes exactly what you asked for and does not check that it is what you meant. Review it before signing.'];
  if (!r.verified) warnings.push('The ABI was decoded from bytecode, not verified source: the function name is a best guess from public signature databases.');
  if (info.flags.includes('admin-likely')) warnings.push('This looks like an owner/role-only function; it will likely revert for this wallet.');
  if (info.flags.includes('arbitrary-call')) warnings.push('This function runs calls or code passed in the arguments. Only sign if you know exactly what they do.');
  if (r.proxies.length) warnings.push(`The contract is a proxy (${r.proxies.join(', ')}); its code can be changed by its admin.`);
  if (/^approve$|^increaseAllowance$/.test(item.name) && values.some((x) => x === maxUint256)) warnings.push('Unlimited approval: the spender can move all of this token from the wallet. Prefer the exact amount.');
  if (info.kind === 'read') warnings.push('This is a read function: sending it as a transaction only costs gas. Use read_contract instead.');

  const client = getChainClient(t.chainId)!;
  const sim = await simulate(client, wallet, { to: t.address, data, value }, null);
  const gas = sim.status === 'passed' ? await client.estimateGas({ account: wallet, to: t.address, data, value }).catch(() => null) : null;
  return {
    chainId: t.chainId, contract: t.address, function: info.signature, args: a.args,
    abiSource: r.verified ? 'verified' : 'bytecode',
    simulation: sim,
    transactions: txOut([{ to: t.address, data, value, gas: gas ?? undefined, label: `Call ${info.signature}` }], t.chainId, wallet),
    warnings,
    notes: [
      'If the function moves an ERC-20 from the wallet, an approve() to this contract may be needed first: build it with build_tx on the token.',
      'Nothing was signed or sent. Not financial advice.',
    ],
  };
}
