'use client';

import { ThemeProvider } from 'next-themes';
import { Web3Provider } from './components/providers/Web3Provider';
import { WalletProvider } from './context/ModernWalletContext';
import { LazyMotion, domAnimation } from 'framer-motion';

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
      enableSystem={false}
      storageKey="btb-theme"
      disableTransitionOnChange
    >
      <Web3Provider cookie={cookie || undefined}>
        <WalletProvider>
          <LazyMotion features={domAnimation}>
            {children}
          </LazyMotion>
        </WalletProvider>
      </Web3Provider>
    </ThemeProvider>
  );
}
