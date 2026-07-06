'use client';

/**
 * Real TradingView-style candlestick chart via GeckoTerminal's free, keyless
 * embeddable widget — full pan/zoom/timeframe controls, unlike our hand-rolled
 * SVG candlesticks. GeckoTerminal indexes Uniswap V4 pools by the same poolId
 * hash we already compute, so `poolAddress` here is either a real V3/PancakeSwap
 * pool contract address or a V4 poolId — same embed URL shape either way.
 */
export function GeckoTerminalChart({ poolAddress, network = 'eth' }: { poolAddress: string; network?: string }) {
  // The widget is the pool page itself with ?embed=1 — there is no separate
  // "/embed" path (that 404s).
  const src = `https://www.geckoterminal.com/${network}/pools/${poolAddress.toLowerCase()}?embed=1&info=0&swaps=0&light_chart=0`;
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', height: 420 }}>
      <iframe
        src={src}
        title="Pool price chart"
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="clipboard-write"
      />
    </div>
  );
}
