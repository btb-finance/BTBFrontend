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
