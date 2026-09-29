'use client';
import { ClientApp } from './ClientOnly';

// Deep-link routes (/discover/<chain>[/<pair>]) are rendered on demand by a
// serverless function. SSR-ing the wallet providers there crashes (indexedDB
// is not defined), so the app mounts on the client only through the same
// entry as every other route. Page metadata is still rendered server-side, so
// share previews work for crawlers.
export function AppClientOnly() {
  return <ClientApp/>;
}
