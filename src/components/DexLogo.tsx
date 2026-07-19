'use client';

const DEX_ASSETS: [RegExp, string][] = [
  [/aerodrome/i, 'aerodrome'],
  [/balancer/i, 'balancer'],
  [/baseswap/i, 'baseswap'],
  [/beets/i, 'beets'],
  [/camelot/i, 'camelot'],
  [/curve/i, 'curve'],
  [/fluid/i, 'fluid'],
  [/hydrex/i, 'hydrex'],
  [/pancake/i, 'pancakeswap'],
  [/pharaoh/i, 'pharaoh'],
  [/quickswap/i, 'quickswap'],
  [/sparkdex/i, 'sparkdex'],
  [/sushi/i, 'sushiswap'],
  [/swaphood/i, 'swaphood'],
  [/trader joe|lfj/i, 'trader-joe'],
  [/uniswap/i, 'uniswap'],
  [/velodrome/i, 'velodrome'],
];

function dexAsset(name: string): string | null {
  const match = DEX_ASSETS.find(([pattern]) => pattern.test(name));
  return match ? `/dexes/${match[1]}.webp` : null;
}

export function DexLogo({ name, size = 18 }: { name: string; size?: number }) {
  const src = dexAsset(name);
  const shared = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: '50%',
  };
  if (!src) {
    return (
      <span aria-hidden="true" style={{
        ...shared,
        display: 'inline-grid',
        placeItems: 'center',
        background: 'rgba(255,255,255,.09)',
        color: 'rgba(255,255,255,.7)',
        fontSize: Math.max(8, size * .5),
        fontWeight: 800,
      }}>
        {name.trim().charAt(0).toUpperCase() || 'D'}
      </span>
    );
  }
  return (
    <img
      aria-hidden="true"
      alt=""
      src={src}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{ ...shared, display: 'block', objectFit: 'contain' }}
    />
  );
}
