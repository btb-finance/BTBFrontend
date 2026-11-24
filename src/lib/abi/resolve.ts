import { whatsabi } from '@shazow/whatsabi';
import { toFunctionSelector, toFunctionSignature, type AbiFunction, type AbiParameter } from 'viem';
import { getChainClient } from '../chainClient';

// The ABI of any contract on a chain BTB has an RPC for, so agents can read and call any function without bringing
// their own. Order: Sourcify's verified source (open data); otherwise the function selectors in the deployed bytecode,
// named from the public signature databases (OpenChain, 4byte). Proxies are followed to their implementation.
// Shared by the MCP connector (src/lib/mcp) and the Convex ABI store (convex/abisActions.ts).

export type AbiSource = 'sourcify' | 'bytecode';

export interface AbiFn {
  name: string | null;
  /** e.g. "supply(address,uint256,address,uint16)", or null when only the selector is known. */
  signature: string | null;
  selector: `0x${string}`;
  stateMutability: 'view' | 'pure' | 'nonpayable' | 'payable';
  kind: 'read' | 'write';
  inputs: readonly AbiParameter[];
  outputs: readonly AbiParameter[] | null;
  /** Heuristic warnings: admin-likely, arbitrary-call, payable, unnamed, guessed (bytecode ABI). */
  flags: string[];
}

export interface ResolvedAbi {
  chainId: number;
  /** The address asked about. */
  address: string;
  /** The contract whose ABI this is: the implementation when `address` is a proxy, else `address`. */
  abiAddress: string;
  proxies: string[];
  source: AbiSource;
  verified: boolean;
  hasCode: boolean;
  functions: AbiFn[];
  /** Full function entries for encoding and decoding (viem shape). */
  abi: AbiFunction[];
  resolvedAt: number;
}

const ADMIN = /^(set[A-Z_0-9]|upgrade|initiali[sz]e|init$|init[A-Z_]|pause$|unpause$|transferOwnership|acceptOwnership|renounceOwnership|grantRole|revokeRole|renounceRole|changeAdmin|rescue|sweep|recover[A-Z]|emergency|kill|withdrawFees|collectProtocol|addMinter|removeMinter|blacklist|whitelist|setFee)/;
const ARBITRARY = /^(multicall|execute|exec|aggregate|tryAggregate|delegate[cC]all|callFunction|batchCall)/;

function classify(fn: AbiFunction, guessed: boolean): AbiFn {
  const named = !!fn.name && !/^0x[0-9a-f]{8}$/i.test(fn.name);
  const signature = named ? toFunctionSignature(fn) : null;
  const selector = (named ? toFunctionSelector(fn) : (fn as AbiFunction & { selector?: string }).selector ?? fn.name) as `0x${string}`;
  const stateMutability = fn.stateMutability ?? 'nonpayable';
  const kind = stateMutability === 'view' || stateMutability === 'pure' ? 'read' : 'write';
  const flags: string[] = [];
  if (named && ADMIN.test(fn.name)) flags.push('admin-likely');
  if (named && ARBITRARY.test(fn.name)) flags.push('arbitrary-call');
  if (stateMutability === 'payable') flags.push('payable');
  if (!named) flags.push('unnamed');
  if (guessed) flags.push('guessed');
  return {
    name: named ? fn.name : null, signature, selector, stateMutability, kind,
    inputs: fn.inputs ?? [], outputs: guessed && !fn.outputs?.length ? null : fn.outputs ?? [], flags,
  };
}

/** whatsabi's function entries → viem's AbiFunction (names filled where the signature lookup found one). */
function toViem(entries: unknown[]): AbiFunction[] {
  const out: AbiFunction[] = [];
  for (const e of entries as Record<string, unknown>[]) {
    if (e.type !== 'function') continue;
    const name = typeof e.name === 'string' && e.name ? e.name : typeof e.selector === 'string' ? e.selector : '';
    const stateMutability = (e.stateMutability as AbiFunction['stateMutability']) ?? (e.payable ? 'payable' : 'nonpayable');
    out.push({
      type: 'function', name, stateMutability,
      inputs: (e.inputs as AbiFunction['inputs']) ?? [],
      outputs: (e.outputs as AbiFunction['outputs']) ?? [],
      ...(e.selector ? { selector: e.selector } : {}),
    } as AbiFunction);
  }
  return out;
}

export async function resolveAbi(chainId: number, address: string): Promise<ResolvedAbi> {
  const client = getChainClient(chainId);
  if (!client) throw new Error(`BTB has no RPC for chain ${chainId}.`);
  const first = await whatsabi.autoload(address, {
    provider: client,
    abiLoader: new whatsabi.loaders.SourcifyABILoader({ chainId }),
    signatureLookup: whatsabi.loaders.defaultSignatureLookup,
    followProxies: false,
    onError: () => false, // a failed loader falls through to the next step instead of throwing
  });
  // Follow a proxy one hop ourselves, so the proxy kinds found on the address are kept in the result.
  const proxies = first.proxies.map((p) => p.name);
  let r = first;
  if (proxies.length && first.followProxies) {
    r = await first.followProxies().catch(() => first);
  }
  const verified = !!r.abiLoadedFrom;
  const abi = toViem(r.abi as unknown[]);
  return {
    chainId,
    address: address.toLowerCase(),
    abiAddress: r.address.toLowerCase(),
    proxies,
    source: verified ? 'sourcify' : 'bytecode',
    verified,
    hasCode: first.hasCode,
    functions: abi.map((f) => classify(f, !verified)),
    abi,
    resolvedAt: Date.now(),
  };
}

/** How long a stored ABI is trusted: proxies can be upgraded, bytecode guesses can improve once verified. */
export function abiTtlMs(a: Pick<ResolvedAbi, 'verified' | 'proxies' | 'hasCode'>): number {
  const day = 86_400_000;
  if (!a.hasCode) return day;
  if (a.proxies.length) return day;
  return a.verified ? 90 * day : 7 * day;
}
