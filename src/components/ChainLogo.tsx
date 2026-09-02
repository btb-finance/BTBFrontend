'use client';
import { useState } from 'react';
import { CHAIN_META } from '../lib/wagmi';

/**
 * `src` is the provider supplied chain icon from the pool row. Two chains have
 * no icon under their normalised name (BNB Chain, Robinhood Chain), so a
 * failed load falls back to the bundled asset keyed by chain id.
 */
export function ChainLogo({ chainId, size = 22, src: remote }: { chainId: number; size?: number; src?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={!failed && remote ? remote : `/chains/${chainId}.webp`}
      onError={() => setFailed(true)}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
        background: CHAIN_META[chainId]?.color ?? 'rgba(255,255,255,.12)',
        boxShadow: '0 0 0 1px rgba(255,255,255,.12)',
      }}
    />
  );
}
