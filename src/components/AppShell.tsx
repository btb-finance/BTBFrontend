'use client';
import { Providers } from './Providers';
import { MiniApp } from './MiniApp';

export function AppShell() {
  return (
    <Providers>
      <MiniApp/>
    </Providers>
  );
}
