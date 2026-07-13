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
  /** 0 on mobile — the sidebar is hidden and overlays should span the full width. */
  width: number;
  /** True below the mobile breakpoint: sidebar is replaced by the bottom nav. */
  isMobile: boolean;
}

const Ctx = createContext<SidebarCtx>({ collapsed: false, forceCollapsed: false, toggle: () => {}, width: EXPANDED_WIDTH, isMobile: false });

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === '1'); } catch {}
  }, []);

  useEffect(() => {
    const mqMobile = window.matchMedia(MOBILE_QUERY);
    const mqNarrow = window.matchMedia(NARROW_QUERY);
    const update = () => { setIsMobile(mqMobile.matches); setNarrow(mqNarrow.matches); };
    update();
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
  const width = isMobile ? 0 : effCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return <Ctx.Provider value={{ collapsed: effCollapsed, forceCollapsed: narrow, toggle, width, isMobile }}>{children}</Ctx.Provider>;
}

export function useSidebar() {
  return useContext(Ctx);
}
