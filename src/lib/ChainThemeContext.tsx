'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useConnection } from 'wagmi';
import { CHAIN_THEMES, DEFAULT_CHAIN_THEME, chainThemeCss, type ChainTheme } from './chainThemes';

const STORAGE_KEY = 'btb-active-chain-theme';

interface ChainThemeContextValue {
  chainId: number;
  theme: ChainTheme;
  setThemeChainId: (chainId: number) => void;
}

const ChainThemeContext = createContext<ChainThemeContextValue>({
  chainId: DEFAULT_CHAIN_THEME.chainId,
  theme: DEFAULT_CHAIN_THEME,
  setThemeChainId: () => {},
});

export function ChainThemeProvider({ children }: { children: ReactNode }) {
  const { chainId: walletChainId } = useConnection();
  const [chainId, setChainId] = useState(DEFAULT_CHAIN_THEME.chainId);

  const setThemeChainId = useCallback((nextChainId: number) => {
    if (!CHAIN_THEMES[nextChainId]) return;
    setChainId(nextChainId);
    localStorage.setItem(STORAGE_KEY, String(nextChainId));
  }, []);

  useEffect(() => {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    if (CHAIN_THEMES[stored]) setChainId(stored);
  }, []);

  useEffect(() => {
    if (walletChainId && CHAIN_THEMES[walletChainId]) setThemeChainId(walletChainId);
  }, [walletChainId, setThemeChainId]);

  const theme = CHAIN_THEMES[chainId] ?? DEFAULT_CHAIN_THEME;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.chainTheme = String(theme.chainId);
    root.dataset.chainName = theme.name;
    const variables = chainThemeCss(theme);
    for (const [property, value] of Object.entries(variables)) root.style.setProperty(property, value);
  }, [theme]);

  const value = useMemo(() => ({ chainId: theme.chainId, theme, setThemeChainId }), [theme, setThemeChainId]);
  return <ChainThemeContext.Provider value={value}>{children}</ChainThemeContext.Provider>;
}

export function useChainTheme() {
  return useContext(ChainThemeContext);
}
