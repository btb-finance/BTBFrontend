'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children at document.body. Bottom sheets / modals MUST use this:
 * screens render inside the phone-frame div (MiniApp), which is a stacking
 * context at zIndex 1 — a `position: fixed` overlay inside it can never paint
 * above the TabBar (a frame sibling at zIndex 100), whatever its own zIndex.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
