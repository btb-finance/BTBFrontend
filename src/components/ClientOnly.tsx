'use client';
import dynamic from 'next/dynamic';
import { AppSkeleton } from './AppSkeleton';
import { startDiscoverSnapshot } from '@/lib/discoverSnapshot';

// The pool snapshot does not need a wallet, so its request leaves as soon as
// this small entry chunk runs, in parallel with the app shell download.
startDiscoverSnapshot();

// One client-only boundary for the whole app (wallet connectors touch
// indexedDB, which the server does not have). The skeleton is its SSR output,
// so the HTML already paints the app frame.
const AppShell = dynamic(() => import('./AppShell').then(m => m.AppShell), { ssr: false, loading: AppSkeleton });

export function ClientApp() {
  return <AppShell/>;
}
