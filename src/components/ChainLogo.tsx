'use client';
import { CHAIN_META } from '../lib/wagmi';

export function ChainLogo({ chainId, size = 22 }: { chainId: number; size?: number }) {
  return (
    <img
      src={`/chains/${chainId}.webp`}
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
