'use client';

import { ThemeProvider } from 'next-themes';
import { WalletProvider } from './context/WalletContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider 
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="btb-theme"
      disableTransitionOnChange
    >
      <WalletProvider>
        {children}
      </WalletProvider>
    </ThemeProvider>
  );
}
