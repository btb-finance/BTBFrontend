'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useConnection } from 'wagmi';
import { CHAIN_THEMES, DEFAULT_CHAIN_THEME, chainThemeCss, type ChainTheme, type ColorMode } from './chainThemes';

const STORAGE_KEY = 'btb-active-chain-theme';
const MODE_KEY = 'btb-color-mode';

interface ChainThemeContextValue {
  chainId: number;
  theme: ChainTheme;
  setThemeChainId: (chainId: number) => void;
  mode: ColorMode;
  toggleMode: () => void;
}

const ChainThemeContext = createContext<ChainThemeContextValue>({
  chainId: DEFAULT_CHAIN_THEME.chainId,
  theme: DEFAULT_CHAIN_THEME,
  setThemeChainId: () => {},
  mode: 'dark',
  toggleMode: () => {},
});

export function ChainThemeProvider({ children }: { children: ReactNode }) {
  const { chainId: walletChainId } = useConnection();
  const [chainId, setChainId] = useState(DEFAULT_CHAIN_THEME.chainId);
  const [mode, setMode] = useState<ColorMode>('dark');
  const toggleMode = useCallback(() => {
    setMode(m => { const next = m === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(MODE_KEY, next); } catch {} return next; });
  }, []);

  const setThemeChainId = useCallback((nextChainId: number) => {
    if (!CHAIN_THEMES[nextChainId]) return;
    setChainId(nextChainId);
    localStorage.setItem(STORAGE_KEY, String(nextChainId));
  }, []);

  useEffect(() => {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    if (CHAIN_THEMES[stored]) setChainId(stored);
    try { if (localStorage.getItem(MODE_KEY) === 'light') setMode('light'); } catch {}
  }, []);

  useEffect(() => {
    if (walletChainId && CHAIN_THEMES[walletChainId]) setThemeChainId(walletChainId);
  }, [walletChainId, setThemeChainId]);

  const theme = CHAIN_THEMES[chainId] ?? DEFAULT_CHAIN_THEME;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.chainTheme = String(theme.chainId);
    root.dataset.chainName = theme.name;
    root.dataset.mode = mode;
    root.style.colorScheme = mode;
    // Safari tints its toolbar and the home-screen web app frame from the
    // theme-color meta; keep it in step with the mode the user chose.
    const paper = mode === 'light' ? '#E8EAF0' : '#0A0A0F';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = paper;
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"][media]').forEach((m) => { m.content = paper; });
    const variables = chainThemeCss(theme, mode);
    for (const [property, value] of Object.entries(variables)) root.style.setProperty(property, value);
  }, [theme, mode]);

  const value = useMemo(() => ({ chainId: theme.chainId, theme, setThemeChainId, mode, toggleMode }), [theme, setThemeChainId, mode, toggleMode]);
  return <ChainThemeContext.Provider value={value}>{children}</ChainThemeContext.Provider>;
}

export function useChainTheme() {
  return useContext(ChainThemeContext);
}
