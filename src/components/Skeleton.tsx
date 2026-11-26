import type { ReactNode } from 'react';

/**
 * A soft shimmering bar where a number is still loading, instead of "...", which read as broken. Sized in em so it
 * matches the text it stands in for. The animation lives in globals.css (.btb-skel) and stops for reduced motion.
 */
export function Skeleton({ width = '3.2em', height = '0.8em' }: { width?: string | number; height?: string | number }) {
  return <span className="btb-skel" aria-label="Loading" role="status" style={{ width, height }}/>;
}

/** The value, or a Skeleton while it is still the loading placeholder ("..." or "…"). */
export function orSkeleton(value: ReactNode, width?: string): ReactNode {
  return value === '...' || value === '…' ? <Skeleton width={width}/> : value;
}
