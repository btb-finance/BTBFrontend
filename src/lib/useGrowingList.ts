'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Draw a long list a batch at a time: the first `step` items at once, then another batch each time the end of the
 * list scrolls into view (or "Show more" is pressed). Discover drew all ~3,700 pools on load, which kept phones busy
 * for half a minute; sorting and filtering still see every item, only the drawing waits.
 */
export function useGrowingList(total: number, step: number) {
  const [count, setCount] = useState(step);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const more = () => setCount((c) => Math.min(total, c + step));

  useEffect(() => {
    const el = sentinel.current;
    if (!el || count >= total || typeof IntersectionObserver === 'undefined') return;
    // Start the next batch a screen early, so scrolling rarely reaches the end.
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setCount((c) => Math.min(total, c + step));
    }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [count, total, step]);

  return { count: Math.min(count, total), more, left: Math.max(0, total - count), sentinel };
}
