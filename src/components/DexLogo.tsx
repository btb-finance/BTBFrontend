'use client';
import { useState } from 'react';

const DEX_ASSETS: [RegExp, string][] = [
  [/aerodrome/i, 'aerodrome'],
  [/balancer/i, 'balancer'],
  [/baseswap/i, 'baseswap'],
  [/beets|beethoven/i, 'beets'],
  [/bluefin/i, 'bluefin'],
  [/brownfi/i, 'brownfi'],
  [/camelot/i, 'camelot'],
  [/cetus/i, 'cetus'],
  [/curve/i, 'curve'],
  [/fluid/i, 'fluid'],
  [/flowx/i, 'flowx'],
  [/full sail/i, 'full-sail'],
  [/gliquid/i, 'gliquid'],
  [/hx finance/i, 'hx-finance'],
  [/hybra/i, 'hybra'],
  [/hydrex/i, 'hydrex'],
  [/hyperbrick/i, 'hyperbrick'],
  [/hyperlynx/i, 'hyperlynx'],
  [/hyperswap/i, 'hyperswap'],
  [/hypertrade/i, 'hypertrade'],
  [/kittenswap/i, 'kittenswap'],
  [/^nest(?:\s|$)/i, 'nest'],
  [/noxa/i, 'noxa'],
  [/orca/i, 'orca'],
  [/pancake/i, 'pancakeswap'],
  [/pharaoh/i, 'pharaoh'],
  [/project x/i, 'project-x'],
  [/quickswap/i, 'quickswap'],
  [/raydium/i, 'raydium'],
  [/ramses/i, 'ramses'],
  [/skate/i, 'skate'],
  [/sparkdex/i, 'sparkdex'],
  [/spinup/i, 'spinup'],
  [/sushi/i, 'sushiswap'],
  [/swaphood/i, 'swaphood'],
  [/trader joe|lfj/i, 'trader-joe'],
  [/turbos/i, 'turbos'],
  [/ultrasolid/i, 'ultrasolid'],
  [/uniswap/i, 'uniswap'],
  [/upheaval/i, 'upheaval'],
  [/velodrome/i, 'velodrome'],
  [/wombat/i, 'wombat'],
  [/woofi/i, 'woofi'],
];

function dexAsset(name: string): string | null {
  const match = DEX_ASSETS.find(([pattern]) => pattern.test(name));
  return match ? `/dexes/${match[1]}.webp` : null;
}

/**
 * `src` is the provider supplied logo carried on the pool row. It wins when
 * present; the bundled asset is the fallback, and a letter mark the last
 * resort. That ordering means a venue we have never heard of still gets a real
 * logo without anyone adding a file.
 */
export function DexLogo({ name, size = 18, src: remote }: { name: string; size?: number; src?: string }) {
  const local = dexAsset(name);
  const [failed, setFailed] = useState(false);
  const src = !failed && remote ? remote : local;
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
      onError={() => setFailed(true)}
      style={{ ...shared, display: 'block', objectFit: 'contain' }}
    />
  );
}
