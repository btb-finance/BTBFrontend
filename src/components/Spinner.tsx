import { CSSProperties } from 'react';

interface SpinnerProps {
  size?: number;
  /** Stroke color of the moving arc. */
  color?: string;
  /** Color of the faint track behind the arc. */
  track?: string;
  style?: CSSProperties;
}

/**
 * Single source of truth for the loading spinner that used to be copy-pasted
 * (as inline divs + per-file `@keyframes spin`) across every screen.
 * The `spin` keyframe lives once in globals.css.
 */
export function Spinner({ size = 16, color = '#fff', track = 'rgba(255,255,255,0.25)', style }: SpinnerProps) {
  return (
    <div
      className="spin"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${track}`,
        borderTopColor: color,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
