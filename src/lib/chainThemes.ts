export interface ChainTheme {
  chainId: number;
  name: string;
  accent: `#${string}`;
  accent2: `#${string}`;
  background: `#${string}`;
  /** Official brand guide when available, otherwise the chain's official site. */
  brandSource: string;
}

/**
 * Chain-native dark themes. Primary colors come from official brand guides
 * where published and from the official network identity otherwise.
 *
 * Keep this registry aligned with SUPPORTED_CHAINS in wagmi.ts.
 */
export const CHAIN_THEMES: Record<number, ChainTheme> = {
  1:      { chainId: 1, name: 'Ethereum', accent: '#627EEA', accent2: '#8C8DFC', background: '#080A12', brandSource: 'https://ethereum.org/assets/' },
  56:     { chainId: 56, name: 'BNB Chain', accent: '#F0B90B', accent2: '#FFD75E', background: '#0B0E11', brandSource: 'https://www.bnbchain.org/en/brand-guidelines' },
  137:    { chainId: 137, name: 'Polygon', accent: '#8247E5', accent2: '#B085F5', background: '#0F091B', brandSource: 'https://polygon.technology/brand-guidelines' },
  42161:  { chainId: 42161, name: 'Arbitrum', accent: '#016BE5', accent2: '#10E1FF', background: '#05102A', brandSource: 'https://arbitrum.io/brand-kit' },
  10:     { chainId: 10, name: 'Optimism', accent: '#FF0420', accent2: '#FF6B7A', background: '#120608', brandSource: 'https://www.optimism.io/' },
  8453:   { chainId: 8453, name: 'Base', accent: '#0000FF', accent2: '#3C8AFF', background: '#0A0B0D', brandSource: 'https://brand.base.org/color' },
  43114:  { chainId: 43114, name: 'Avalanche', accent: '#E84142', accent2: '#FF7778', background: '#130708', brandSource: 'https://support.avax.network/en/articles/4132288-avalanche-brand-assets' },
  80094:  { chainId: 80094, name: 'Berachain', accent: '#FF8A00', accent2: '#FFC14D', background: '#160C03', brandSource: 'https://www.berachain.com/' },
  146:    { chainId: 146, name: 'Sonic', accent: '#7C5CFC', accent2: '#20C8FF', background: '#08091B', brandSource: 'https://www.soniclabs.com/' },
  2020:   { chainId: 2020, name: 'Ronin', accent: '#1273EA', accent2: '#57A4FF', background: '#07101E', brandSource: 'https://roninchain.com/' },
  130:    { chainId: 130, name: 'Unichain', accent: '#F50DB4', accent2: '#FEAFF0', background: '#160312', brandSource: 'https://www.unichain.org/brand-kit' },
  59144:  { chainId: 59144, name: 'Linea', accent: '#61DFFF', accent2: '#8B7CFF', background: '#071216', brandSource: 'https://linea.build/assets' },
  999:    { chainId: 999, name: 'HyperEVM', accent: '#50E3C2', accent2: '#9AFFF0', background: '#061511', brandSource: 'https://hyperfoundation.org/' },
  9745:   { chainId: 9745, name: 'Plasma', accent: '#7B61FF', accent2: '#B8A9FF', background: '#0C091A', brandSource: 'https://www.plasma.to/' },
  42793:  { chainId: 42793, name: 'Etherlink', accent: '#2C7DF7', accent2: '#77ACFF', background: '#07101D', brandSource: 'https://www.etherlink.com/' },
  5000:   { chainId: 5000, name: 'Mantle', accent: '#00D1B2', accent2: '#72F2DE', background: '#061310', brandSource: 'https://www.mantle.xyz/' },
  534352: { chainId: 534352, name: 'Scroll', accent: '#FFEEDA', accent2: '#EBC28E', background: '#171109', brandSource: 'https://scroll.io/' },
  250:    { chainId: 250, name: 'Fantom', accent: '#1969FF', accent2: '#13B5EC', background: '#07101D', brandSource: 'https://fantom.foundation/' },
  81457:  { chainId: 81457, name: 'Blast', accent: '#FCFC03', accent2: '#FFF978', background: '#151500', brandSource: 'https://blast.io/' },
  324:    { chainId: 324, name: 'zkSync', accent: '#8C8DFC', accent2: '#C1C2FF', background: '#0B0B17', brandSource: 'https://www.zksync.io/' },
  143:    { chainId: 143, name: 'Monad', accent: '#836EF9', accent2: '#C4B9FF', background: '#0D091A', brandSource: 'https://www.monad.xyz/' },
  4326:   { chainId: 4326, name: 'MegaETH', accent: '#F04E45', accent2: '#FFB000', background: '#160807', brandSource: 'https://www.megaeth.com/' },
  4663:   { chainId: 4663, name: 'Robinhood Chain', accent: '#CCFF00', accent2: '#F0FF99', background: '#080A08', brandSource: 'https://robinhood.com/us/en/newsroom/a-new-visual-identity/' },
};

export const DEFAULT_CHAIN_THEME = CHAIN_THEMES[1];

function hexRgb(hex: string): string {
  const value = hex.replace('#', '');
  return `${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}`;
}

export function chainThemeCss(theme: ChainTheme): Record<string, string> {
  const accentRgb = hexRgb(theme.accent);
  return {
    '--chain-bg': '#0A0A0F',
    '--chain-accent': theme.accent,
    '--chain-accent-2': theme.accent2,
    '--chain-accent-soft': `rgba(${accentRgb}, .08)`,
    '--chain-surface': 'rgba(255,255,255,.052)',
    '--chain-surface-strong': 'rgba(255,255,255,.075)',
    '--chain-surface-soft': 'rgba(255,255,255,.03)',
    '--chain-border': '1px solid rgba(255,255,255,.10)',
    '--chain-border-soft': '1px solid rgba(255,255,255,.06)',
    '--chain-shadow': '0 8px 32px rgba(0,0,0,.38), 0 1px 0 rgba(255,255,255,.055) inset',
    '--chain-gradient': 'linear-gradient(135deg, rgba(255,255,255,.97), rgba(215,218,225,.88))',
    '--chain-app-background': '#0A0A0F',
  };
}
