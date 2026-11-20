'use client';
// Each screen, overlay and modal is its own chunk. Bundled together they were ~900 KB that every visitor downloaded
// before the first paint, whatever tab they opened. The loaders live here, memoized, so the shell (next/dynamic), the
// idle warmup and the nav's hover/touch warmup all share one download per chunk.

const loaders = {
  home:      () => import('./screens/HomeScreen'),
  discover:  () => import('./screens/DiscoverScreen'),
  simulate:  () => import('./screens/SimulateScreen'),
  smartlps:  () => import('./screens/SmartLpsScreen'),
  swap:      () => import('./screens/SwapScreen'),
  portfolio: () => import('./screens/PortfolioScreen'),
  nft:       () => import('./screens/NFTScreen'),
  stake:     () => import('./screens/StakeScreen'),
  allocate:  () => import('./screens/AllocateScreen'),
  scan:      () => import('./screens/ScanScreen'),
  docs:      () => import('./screens/DocsScreen'),
  connect:   () => import('./screens/ConnectScreen'),
  agentDock: () => import('./AgentDock'),
  send:      () => import('./SendModal'),
  receive:   () => import('./ReceiveModal'),
} as const;

export type ScreenKey = keyof typeof loaders;

const started = new Map<ScreenKey, Promise<unknown>>();

/** The chunk for `key`, downloading it on first call; later calls share the same promise. */
export function loadScreen<K extends ScreenKey>(key: K): ReturnType<(typeof loaders)[K]> {
  let p = started.get(key);
  if (!p) {
    p = loaders[key]();
    // A failed download (offline, deploy swapped the chunk) is retried on the next call instead of cached.
    p.catch(() => started.delete(key));
    started.set(key, p);
  }
  return p as ReturnType<(typeof loaders)[K]>;
}

/** Start downloading a screen the user is about to open (nav hover, focus, touch). Never throws. */
export function warmScreen(key: string) {
  if (key in loaders) loadScreen(key as ScreenKey).catch(() => {});
}

/** On a data saver or a 2G connection, warm nothing ahead of a tap: the bytes cost the user more than the wait. */
export function shouldSaveData() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType ?? ''));
}

/** Props for a nav item: start the screen's download on hover, keyboard focus or the first touch, before the click. */
export function warmOn(key: string) {
  const warm = () => warmScreen(key);
  return { onPointerEnter: warm, onFocus: warm, onTouchStart: warm };
}
