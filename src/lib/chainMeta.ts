// Chain names, symbols and colours for display. Its own module (no wallet-stack imports) so server-rendered pages can
// read it; re-exported from ./wagmi so existing imports keep working.
// Chain metadata for UI display
export const CHAIN_META: Record<number, { name: string; symbol: string; color: string }> = {
  1:      { name: 'Ethereum',  symbol: 'ETH',  color: '#627EEA' },
  56:     { name: 'BNB Chain', symbol: 'BNB',  color: '#F3BA2F' },
  137:    { name: 'Polygon',   symbol: 'MATIC', color: '#8247E5' },
  42161:  { name: 'Arbitrum',  symbol: 'ETH',  color: '#28A0F0' },
  10:     { name: 'Optimism',  symbol: 'ETH',  color: '#FF0420' },
  8453:   { name: 'Base',      symbol: 'ETH',  color: '#0052FF' },
  43114:  { name: 'Avalanche', symbol: 'AVAX', color: '#E84142' },
  4663:   { name: 'Robinhood Chain', symbol: 'ETH', color: '#00C805' },
  5042:   { name: 'Arc', symbol: 'USDC', color: '#2775CA' },
  250:    { name: 'Fantom',    symbol: 'FTM',  color: '#1969FF' },
  59144:  { name: 'Linea',     symbol: 'ETH',  color: '#61DFFF' },
  534352: { name: 'Scroll',    symbol: 'ETH',  color: '#FFEEDA' },
  324:    { name: 'zkSync',    symbol: 'ETH',  color: '#8C8DFC' },
  81457:  { name: 'Blast',     symbol: 'ETH',  color: '#FCFC03' },
  80094:  { name: 'Berachain', symbol: 'BERA', color: '#FF8A00' },
  2020:   { name: 'Ronin', symbol: 'RON', color: '#1273EA' },
  130:    { name: 'Unichain', symbol: 'ETH', color: '#FF37C7' },
  999:    { name: 'HyperEVM', symbol: 'HYPE', color: '#50E3C2' },
  9745:   { name: 'Plasma', symbol: 'XPL', color: '#7B61FF' },
  42793:  { name: 'Etherlink', symbol: 'XTZ', color: '#2C7DF7' },
  5000:   { name: 'Mantle', symbol: 'MNT', color: '#00D1B2' },
  143:    { name: 'Monad', symbol: 'MON', color: '#836EF9' },
  4326:   { name: 'MegaETH', symbol: 'ETH', color: '#F04E45' },
};
