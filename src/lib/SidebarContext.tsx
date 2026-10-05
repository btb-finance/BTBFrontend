'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 76;
const STORAGE_KEY = 'btb-sidebar-collapsed';
const MOBILE_QUERY = '(max-width: 768px)';
// Half-screen windows (VS Code side-by-side, small laptops): desktop layout,
// but the expanded sidebar would crush the content — force the icon rail.
const NARROW_QUERY = '(min-width: 769px) and (max-width: 1100px)';

interface SidebarCtx {
  collapsed: boolean;
  /** True when collapse is forced by a narrow window — the toggle is inert, hide it. */
  forceCollapsed: boolean;
  toggle: () => void;
  /** Horizontal space taken beside the content. Always 0 since the desktop nav moved to a top bar. */
  width: number;
  /** True below the mobile breakpoint: sidebar is replaced by the bottom nav. */
  isMobile: boolean;
}

const Ctx = createContext<SidebarCtx>({ collapsed: false, forceCollapsed: false, toggle: () => {}, width: 0, isMobile: false });

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Read on the first render (the app only renders in the browser), so a phone never paints the desktop layout first.
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; } });
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);

  useEffect(() => {
    const mqMobile = window.matchMedia(MOBILE_QUERY);
    const mqNarrow = window.matchMedia(NARROW_QUERY);
    const update = () => { setIsMobile(mqMobile.matches); setNarrow(mqNarrow.matches); };
    mqMobile.addEventListener('change', update);
    mqNarrow.addEventListener('change', update);
    return () => {
      mqMobile.removeEventListener('change', update);
      mqNarrow.removeEventListener('change', update);
    };
  }, []);

  function toggle() {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }

  const effCollapsed = collapsed || narrow;
  // Desktop navigation is a top bar now, so nothing sits beside the content:
  // overlays keyed on `width` span the whole window on every breakpoint.
  const width = 0;
  void EXPANDED_WIDTH; void COLLAPSED_WIDTH;

  return <Ctx.Provider value={{ collapsed: effCollapsed, forceCollapsed: narrow, toggle, width, isMobile }}>{children}</Ctx.Provider>;
}

export function useSidebar() {
  return useContext(Ctx);
}
