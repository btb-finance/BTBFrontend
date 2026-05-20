'use client';

const TOKEN_MAP: Record<string, { bg: string; glyph: string }> = {
  ETH:  { bg: 'linear-gradient(135deg,#627EEA,#3C5AE0)', glyph: 'Ξ' },
  USDC: { bg: 'linear-gradient(135deg,#2775CA,#1A5599)', glyph: '$' },
  USDT: { bg: 'linear-gradient(135deg,#26A17B,#1D7D5E)', glyph: '₮' },
  BTC:  { bg: 'linear-gradient(135deg,#F7931A,#C16E0A)', glyph: '₿' },
  WBTC: { bg: 'linear-gradient(135deg,#F7931A,#C16E0A)', glyph: '₿' },
  SOL:  { bg: 'linear-gradient(135deg,#9945FF,#14F195)', glyph: 'S' },
  ARB:  { bg: 'linear-gradient(135deg,#2D374B,#28A0F0)', glyph: 'A' },
  LINK: { bg: 'linear-gradient(135deg,#2A5ADA,#1840A8)', glyph: '⬡' },
  UNI:  { bg: 'linear-gradient(135deg,#FF007A,#C40060)', glyph: 'U' },
  BTB:  { bg: 'linear-gradient(135deg,rgba(255,255,255,0.2),rgba(255,255,255,0.08))', glyph: 'B' },
};

export function TokenIcon({ symbol, size = 36, logoUrl }: { symbol: string; size?: number; logoUrl?: string }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={symbol}
        width={size}
        height={size}
        style={{ borderRadius: size, flexShrink: 0, objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  const t = TOKEN_MAP[symbol] || { bg: 'linear-gradient(135deg,#666,#222)', glyph: (symbol[0] ?? '?') };
  return (
    <div style={{
      width: size, height: size, borderRadius: size,
      background: t.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.46,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
      flexShrink: 0,
      letterSpacing: -0.5,
    }}>{t.glyph}</div>
  );
}
