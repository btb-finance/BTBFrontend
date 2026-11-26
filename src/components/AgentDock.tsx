'use client';
import { useEffect, useState } from 'react';
import { Portal } from './Portal';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';

/**
 * The agent, one tap from anywhere in the classic app: a message bubble in the corner that opens the Ask interface
 * (/ask), where people say what they want in plain English and sign the steps it builds. Hidden on the Agent tab.
 */
export function AgentDock({ hidden }: { hidden?: boolean }) {
  const { isMobile } = useSidebar();

  // Phone: the round button shows for 5 seconds, then tucks into a slim tab on the right edge, above any
  // bottom action bar, so it never covers a button. Scrolling tucks it at once.
  const [tucked, setTucked] = useState(false);
  if (!isMobile && tucked) setTucked(false);
  useEffect(() => {
    if (!isMobile) return;
    const t = setTimeout(() => setTucked(true), 5000);
    const onScroll = () => setTucked(true);
    window.addEventListener('scroll', onScroll, { passive: true, once: true });
    return () => { clearTimeout(t); window.removeEventListener('scroll', onScroll); };
  }, [isMobile]);
  const tab = isMobile && tucked;

  if (hidden) return null;

  return (
    <Portal>
        <a href="/ask" aria-label="Ask the BTB Agent" title="Ask BTB" style={{
          position: 'fixed', right: tab ? 0 : isMobile ? 14 : 24, zIndex: 410,
          bottom: tab ? 'calc(190px + env(safe-area-inset-bottom))' : isMobile ? 'calc(78px + env(safe-area-inset-bottom))' : 24,
          width: tab ? 30 : 52, height: tab ? 48 : 52, borderRadius: tab ? '14px 0 0 14px' : 999, border: btb.border, borderRight: tab ? 'none' : btb.border, cursor: 'pointer',
          opacity: tab ? 0.9 : 1, padding: 0, transition: 'width 200ms ease, height 200ms ease, right 200ms ease, bottom 200ms ease, border-radius 200ms ease',
          background: btb.gradGreen, color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          display: 'flex', textDecoration: 'none', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width={tab ? 16 : 22} height={tab ? 16 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/></svg>
        </a>
    </Portal>
  );
}
