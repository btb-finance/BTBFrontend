'use client';
import dynamic from 'next/dynamic';

// Deep-link routes (/discover/<chain>[/<pair>]) are rendered on demand by a
// serverless function. SSR-ing the wallet providers there crashes (indexedDB
// is not defined), so we mount the whole app on the client only. Page metadata
// is still rendered server-side, so share previews work for crawlers.
const AppShell = dynamic(() => import('./AppShell').then((m) => m.AppShell), { ssr: false });

export function AppClientOnly() {
  return <AppShell/>;
}
