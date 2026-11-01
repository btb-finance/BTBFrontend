'use client';
import { Providers } from './Providers';
import { MiniApp } from './MiniApp';
import { HalloweenTheme } from '../seasonal/halloween/HalloweenTheme'; // HALLOWEEN: delete this line to remove the theme

export function AppShell() {
  return (
    <Providers>
      <MiniApp/>
      <HalloweenTheme/>{/* HALLOWEEN: delete this line to remove the theme */}
    </Providers>
  );
}
