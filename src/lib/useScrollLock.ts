'use client';
import { useEffect } from 'react';

let locks = 0;
let saved: { html: string; body: string } | null = null;

/**
 * Freeze the page behind a sheet, window or chat while it is open, so a phone scrolls the sheet and never the
 * page under it. Counted, so two open sheets keep the page frozen until both close.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const html = document.documentElement, body = document.body;
    if (locks++ === 0) {
      saved = { html: html.style.overflow, body: body.style.overflow };
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
    }
    return () => {
      if (--locks === 0 && saved) {
        html.style.overflow = saved.html;
        body.style.overflow = saved.body;
        saved = null;
      }
    };
  }, [active]);
}
