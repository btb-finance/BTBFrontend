'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 76;
const STORAGE_KEY = 'btb-sidebar-collapsed';
const MOBILE_QUERY = '(max-width: 768px)';

interface SidebarCtx {
  collapsed: boolean;
  toggle: () => void;
  /** 0 on mobile — the sidebar is hidden and overlays should span the full width. */
  width: number;
  /** True below the mobile breakpoint: sidebar is replaced by the bottom nav. */
  isMobile: boolean;
}

const Ctx = createContext<SidebarCtx>({ collapsed: false, toggle: () => {}, width: EXPANDED_WIDTH, isMobile: false });

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === '1'); } catch {}
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  function toggle() {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }

  const width = isMobile ? 0 : collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return <Ctx.Provider value={{ collapsed, toggle, width, isMobile }}>{children}</Ctx.Provider>;
}

export function useSidebar() {
  return useContext(Ctx);
}
