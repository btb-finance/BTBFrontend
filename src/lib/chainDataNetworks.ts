export interface ChainDataNetwork {
  gecko: string;
  dexScreener: string;
  dexPaprika: string;
  llama: string;
}

/**
 * Network identifiers used by the market-data providers behind Discover and
 * Simulate. Swap already defines which chain IDs are supported; this only
 * translates those IDs into each provider's naming convention.
 */
export const CHAIN_DATA_NETWORKS: Record<number, ChainDataNetwork> = {
  1:     { gecko: 'eth',             dexScreener: 'ethereum',  dexPaprika: 'ethereum',  llama: 'ethereum' },
  56:    { gecko: 'bsc',             dexScreener: 'bsc',       dexPaprika: 'bsc',       llama: 'bsc' },
  137:   { gecko: 'polygon_pos',     dexScreener: 'polygon',   dexPaprika: 'polygon',   llama: 'polygon' },
  42161: { gecko: 'arbitrum',        dexScreener: 'arbitrum',  dexPaprika: 'arbitrum',  llama: 'arbitrum' },
  10:    { gecko: 'optimism',        dexScreener: 'optimism',  dexPaprika: 'optimism',  llama: 'optimism' },
  8453:  { gecko: 'base',            dexScreener: 'base',      dexPaprika: 'base',      llama: 'base' },
  43114: { gecko: 'avax',            dexScreener: 'avalanche', dexPaprika: 'avalanche', llama: 'avax' },
  59144: { gecko: 'linea',           dexScreener: 'linea',     dexPaprika: 'linea',     llama: 'linea' },
  80094: { gecko: 'berachain',       dexScreener: 'berachain', dexPaprika: 'berachain', llama: 'berachain' },
  146:   { gecko: 'sonic',           dexScreener: 'sonic',     dexPaprika: 'sonic',     llama: 'sonic' },
  2020:  { gecko: 'ronin',           dexScreener: 'ronin',     dexPaprika: 'ronin',     llama: 'ronin' },
  130:   { gecko: 'unichain',        dexScreener: 'unichain',  dexPaprika: 'unichain',  llama: 'unichain' },
  999:   { gecko: 'hyperevm',        dexScreener: 'hyperevm',  dexPaprika: 'hyperevm',  llama: 'hyperevm' },
  9745:  { gecko: 'plasma',          dexScreener: 'plasma',    dexPaprika: 'plasma',    llama: 'plasma' },
  42793: { gecko: 'etherlink',       dexScreener: 'etherlink', dexPaprika: 'etherlink', llama: 'etherlink' },
  143:   { gecko: 'monad',           dexScreener: 'monad',     dexPaprika: 'monad',     llama: 'monad' },
  4326:  { gecko: 'megaeth',         dexScreener: 'megaeth',   dexPaprika: 'megaeth',   llama: 'megaeth' },
  // GeckoTerminal's slug is "robinhood" — "robinhood_chain" 404s every
  // endpoint, which silently zeroed out all Gecko data for this chain.
  4663:  { gecko: 'robinhood',        dexScreener: 'robinhood', dexPaprika: 'robinhood', llama: 'robinhood' },
};
