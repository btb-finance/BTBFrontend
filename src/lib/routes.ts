import type { Tab } from '@/components/types';

// URL ↔ app-state mapping. The app is a single React shell (MiniApp) but every
// tab and overlay has a real path, so views are deep-linkable and the browser
// back button works. The [tab] route renders the same shell; MiniApp reads the
// path on load and pushes history entries as the user navigates.

export type Overlay = 'earn' | 'docs' | null;

export const TAB_PATHS: Record<Tab, string> = {
  home: '/',
  discover: '/discover',
  token: '/token',
  simulate: '/simulate',
  swap: '/swap',
  portfolio: '/portfolio',
  nft: '/nft',
  stake: '/agent',
  studio: '/studio',
};

export function pathFor(screen: Tab, overlay: Overlay): string {
  return overlay ? `/${overlay}` : TAB_PATHS[screen];
}

export function parsePath(path: string): { screen: Tab; overlay: Overlay } {
  const seg = path.split('/').filter(Boolean)[0]?.toLowerCase() ?? '';
  if (seg === 'earn' || seg === 'docs') return { screen: 'home', overlay: seg };
  if (seg === '' || seg === 'home' || seg === 'dashboard') return { screen: 'home', overlay: null };
  const entry = (Object.entries(TAB_PATHS) as [Tab, string][]).find(([, p]) => p === `/${seg}`);
  return entry ? { screen: entry[0], overlay: null } : { screen: 'home', overlay: null };
}

// ── Shareable pool deep links: /discover/<chain>/<pair> ──────────────────────
// e.g. /discover/robinhoodchain/cashcat-eth opens the Add-liquidity flow for
// that pool. WETH is normalised to "eth" so the URL reads the way users expect.

function normSymbol(sym: string): string {
  const s = sym.toLowerCase();
  return s === 'weth' ? 'eth' : s;
}

export function chainSlug(chain: string): string {
  return chain.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Order-preserving pair slug, e.g. "CASHCAT-WETH" → "cashcat-eth". */
export function pairSlug(pair: string): string {
  return pair.split(/[-/]/).map(normSymbol).filter(Boolean).join('-');
}

export function poolPath(chain: string, pair: string): string {
  return `/discover/${chainSlug(chain)}/${pairSlug(pair)}`;
}

export function parsePoolPath(path: string): { chain: string; pair: string } | null {
  const segs = path.split('/').filter(Boolean);
  return segs.length === 3 && segs[0].toLowerCase() === 'discover'
    ? { chain: segs[1].toLowerCase(), pair: segs[2].toLowerCase() }
    : null;
}

/** /discover/<chain> → the chain slug (filters Discover to that chain). */
export function parseDiscoverChainPath(path: string): string | null {
  const segs = path.split('/').filter(Boolean);
  return segs.length === 2 && segs[0].toLowerCase() === 'discover' ? segs[1].toLowerCase() : null;
}

/** True when a pool matches a deep-link's chain + pair (order-insensitive). */
export function poolMatchesLink(poolChain: string, poolPair: string, link: { chain: string; pair: string }): boolean {
  if (chainSlug(poolChain) !== link.chain) return false;
  const have = pairSlug(poolPair).split('-').sort().join('-');
  const want = link.pair.split('-').map(normSymbol).sort().join('-');
  return have === want;
}
