'use client';

/**
 * Candlestick price chart. This is GeckoTerminal's free, keyless embeddable
 * widget (an <iframe> of their pool page) — NOT TradingView. It renders a
 * TradingView-style chart but carries a "Powered by GeckoTerminal" watermark
 * that can't be removed on the free embed. It's used because GeckoTerminal
 * indexes any Uniswap/Pancake pool (incl. V4) by address/poolId, which real
 * TradingView has no symbol for. `height` fills the parent column when given.
 */
export function GeckoTerminalChart({ poolAddress, network = 'eth', height = 'min(70vh, 600px)' }: {
  poolAddress: string; network?: string; height?: number | string;
}) {
  // The widget is the pool page itself with ?embed=1 — there is no separate
  // "/embed" path (that 404s). light_chart=0 keeps the DARK theme (=1 is light).
  const src = `https://www.geckoterminal.com/${network}/pools/${poolAddress.toLowerCase()}?embed=1&info=0&swaps=0&light_chart=0`;
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', height, minHeight: 360 }}>
      <iframe
        src={src}
        title="Pool price chart"
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="clipboard-write"
      />
    </div>
  );
}
