'use client';

import { ThemeProvider } from 'next-themes';
import { Web3Provider } from './components/providers/Web3Provider';
import { WalletProvider } from './context/ModernWalletContext';

export function Providers({ 
  children, 
  cookie 
}: { 
  children: React.ReactNode;
  cookie?: string | null;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={true}
      storageKey="btb-theme"
      themes={['light', 'dark']}
    >
      <Web3Provider cookie={cookie || undefined}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </Web3Provider>
    </ThemeProvider>
  );
}
