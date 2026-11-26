'use client';
import dynamic from 'next/dynamic';
import { AskFrame } from '@/components/ask/AskFrame';

// Wallet connectors touch indexedDB, which the server lacks: the live app loads in the browser only. The server
// sends the same layout, so the page paints at once.
const AskApp = dynamic(() => import('@/components/ask/AskApp').then((m) => m.AskApp), { ssr: false, loading: () => <AskFrame/> });

export function AskEntry() {
  return <AskApp/>;
}
