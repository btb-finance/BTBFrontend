'use client';
import dynamic from 'next/dynamic';
import { AskFrame } from '@/components/ask/AskFrame';

const SignApp = dynamic(() => import('@/components/ask/SignApp').then((m) => m.SignApp), { ssr: false, loading: () => <AskFrame title="Sign"><div className="ag-hero"><h2>Loading the steps…</h2></div></AskFrame> });

export function SignEntry() {
  return <SignApp/>;
}
