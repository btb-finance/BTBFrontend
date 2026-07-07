'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 76;
const STORAGE_KEY = 'btb-sidebar-collapsed';

interface SidebarCtx {
  collapsed: boolean;
  toggle: () => void;
  width: number;
}

const Ctx = createContext<SidebarCtx>({ collapsed: false, toggle: () => {}, width: EXPANDED_WIDTH });

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === '1'); } catch {}
  }, []);

  function toggle() {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return <Ctx.Provider value={{ collapsed, toggle, width }}>{children}</Ctx.Provider>;
}

export function useSidebar() {
  return useContext(Ctx);
}
