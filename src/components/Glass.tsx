'use client';
import { CSSProperties, ReactNode } from 'react';
import { btb } from './design-tokens';

interface GlassProps {
  children: ReactNode;
  style?: CSSProperties;
  padding?: number;
  radius?: number;
  strong?: boolean;
  soft?: boolean;
  onClick?: () => void;
}

export function Glass({ children, style, padding = 16, radius = 22, strong = false, soft = false, onClick }: GlassProps) {
  return (
    <div onClick={onClick} style={{
      position: 'relative',
      borderRadius: radius,
      padding,
      background: soft ? btb.glassSoft : strong ? btb.glassStrong : btb.glass,
      border: soft ? btb.borderSoft : btb.border,
      backdropFilter: btb.blur,
      WebkitBackdropFilter: btb.blur,
      boxShadow: btb.shadow,
      overflow: 'hidden',
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
        pointerEvents: 'none',
      }}/>
      {children}
    </div>
  );
}
