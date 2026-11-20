'use client';
import dynamic from 'next/dynamic';
import { AppSkeleton } from './AppSkeleton';
import { RoutePreviewProvider, type RoutePreviewValue } from './RoutePreview';
import { startDiscoverSnapshot } from '@/lib/discoverSnapshot';
import { parsePath } from '@/lib/routes';
import { warmScreen } from './screenLoaders';

// The pool snapshot does not need a wallet, so its request leaves as soon as
// this small entry chunk runs, in parallel with the app shell download.
startDiscoverSnapshot();

// Same for the first screen's own chunk: without this its download only started once the shell had downloaded and
// mounted, one more round trip in a row before anything real showed.
if (typeof window !== 'undefined') {
  const { screen, overlay } = parsePath(window.location.pathname);
  warmScreen(overlay ?? screen);
}

// One client-only boundary for the whole app (wallet connectors touch
// indexedDB, which the server does not have). The skeleton is its SSR output,
// so the HTML already paints the app frame.
const AppShell = dynamic(() => import('./AppShell').then(m => m.AppShell), { ssr: false, loading: AppSkeleton });

/** `preview`: the server-rendered first view of the route's screen, shown until the real one is up (./RoutePreview). */
export function ClientApp({ preview }: { preview?: RoutePreviewValue }) {
  return <RoutePreviewProvider value={preview ?? null}><AppShell/></RoutePreviewProvider>;
}
