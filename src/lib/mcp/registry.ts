import { PROTOCOLS } from './registryData';
import { chainKey } from './data';

// The protocol registry: hand-researched entries (registry/protocols/*.json) for protocols agents ask about,
// with their contracts per chain, the functions an agent would call, off-chain APIs and risks. Every address
// carries the official page it came from. Full ABIs come from get_abi.

export interface ProtocolEntry {
  slug: string;
  name: string;
  category: string;
  description: string;
  website?: string;
  docs?: string;
  defillama?: string;
  chains?: string[];
  vm: 'evm' | 'solana' | 'ton' | 'hyperliquid-l1' | 'mixed';
  agentAccess: 'onchain' | 'api' | 'both';
  contracts: {
    chain: string; chainId: number | null; address: string; name: string; role?: string; proxy?: boolean | null;
    source: string; keyFunctions?: { signature: string; kind: 'read' | 'write'; payable?: boolean; description?: string }[];
  }[];
  offchainApis?: { name: string; url: string; auth?: string; use?: string; source?: string }[];
  actions?: { name: string; description?: string; how?: string }[];
  risks?: string[];
  notes?: string;
  sources?: string[];
  researchedAt?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function findProtocol(q: string): ProtocolEntry | null {
  const n = norm(q);
  return PROTOCOLS.find((p) => norm(p.slug) === n || norm(p.name) === n) ?? null;
}

const sameChain = (a: string, b: string) => chainKey(a) === chainKey(b) || norm(a) === norm(b);

export function listProtocols(o: { category?: string; chain?: string; search?: string }) {
  const q = o.search?.toLowerCase();
  const rows = PROTOCOLS
    .filter((p) => !o.category || p.category.toLowerCase().includes(o.category.toLowerCase()))
    .filter((p) => !o.chain || (p.chains ?? []).some((c) => sameChain(c, o.chain!)) || p.contracts.some((c) => sameChain(c.chain, o.chain!)))
    .filter((p) => !q || `${p.name} ${p.slug} ${p.description} ${p.category}`.toLowerCase().includes(q))
    .map((p) => ({
      slug: p.slug, name: p.name, category: p.category, description: p.description,
      chains: p.chains ?? [...new Set(p.contracts.map((c) => c.chain))],
      vm: p.vm, access: p.agentAccess, contracts: p.contracts.length, apis: p.offchainApis?.length ?? 0,
    }));
  return { count: rows.length, protocols: rows, next: 'get_protocol for contracts, functions, APIs and risks; get_abi for a full ABI.' };
}

export function protocolDetail(q: string, chain?: string) {
  const p = findProtocol(q);
  if (!p) return null;
  const contracts = chain ? p.contracts.filter((c) => sameChain(c.chain, chain)) : p.contracts;
  return {
    ...p,
    contracts,
    ...(chain && !contracts.length ? { chainNote: `No ${p.name} contracts recorded on ${chain}. Recorded chains: ${[...new Set(p.contracts.map((c) => c.chain))].join(', ') || 'none'}.` } : {}),
    howToUse: p.vm === 'evm' || p.vm === 'mixed'
      ? 'EVM contracts: get_abi(chain, address) for the full ABI, read_contract for reads, build_tx for unsigned writes. Integers in base units.'
      : 'Not EVM: use the offchainApis or the program ids with a client for that chain; BTB build tools do not cover it yet.',
  };
}
