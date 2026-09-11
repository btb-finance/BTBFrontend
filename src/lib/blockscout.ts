/**
 * Keyless NFT holdings through Blockscout's public v2 API — replaces the
 * Alchemy NFT index (metered key, went over quota). Blockscout instances
 * exist for every chain the LP screen reads. The app never trusts these ids
 * blindly: each one is re-read from chain (positions(), ownerOf) afterwards,
 * so a stale index can only cost a round trip, never show a wrong position.
 */
export const BLOCKSCOUT_HOSTS: Record<number, string> = {
  1: 'https://eth.blockscout.com',
  8453: 'https://base.blockscout.com',
  4663: 'https://robinhoodchain.blockscout.com',
};

const MAX_PAGES = 20; // 50 per page → 1,000 NFTs before we give up and enumerate on-chain

/** TokenIds the owner holds per contract (keys are lowercase addresses).
 * Throws when the chain has no Blockscout, the API fails, or the wallet holds
 * more NFTs than we are willing to page — callers fall back to on-chain
 * enumeration in every one of those cases. */
export async function fetchOwnedNftTokenIds(chainId: number, owner: string, contracts: string[]): Promise<Map<string, bigint[]>> {
  const host = BLOCKSCOUT_HOSTS[chainId];
  if (!host) throw new Error(`No Blockscout for chain ${chainId}`);
  const out = new Map<string, bigint[]>(contracts.map((c) => [c.toLowerCase(), []]));
  let params: Record<string, string> | null = null;
  for (let page = 0; ; page++) {
    if (page >= MAX_PAGES) throw new Error('Blockscout NFT index truncated');
    const qs = new URLSearchParams({ type: 'ERC-721', ...(params ?? {}) });
    const res = await fetch(`${host}/api/v2/addresses/${owner}/nft?${qs}`, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`Blockscout NFT index ${res.status}`);
    const json = await res.json() as { items?: { id?: string; token?: { address_hash?: string } }[]; next_page_params?: Record<string, string | number> | null };
    for (const item of json.items ?? []) {
      const key = item.token?.address_hash?.toLowerCase();
      if (!key || item.id == null || !out.has(key)) continue;
      try { out.get(key)?.push(BigInt(item.id)); } catch { /* malformed id */ }
    }
    if (!json.next_page_params) break;
    params = Object.fromEntries(Object.entries(json.next_page_params).map(([k, v]) => [k, String(v)]));
  }
  return out;
}
