'use client';
import type { ReactNode } from 'react';
import { Portal } from './Portal';
import { Icon } from './Icon';
import { btb } from './design-tokens';
import { useScrollLock } from '../lib/useScrollLock';

/**
 * Phone version of a dropdown picker: a sheet from the bottom with a title, a
 * search box and a scrolling list. The page behind stays still. Shared by every
 * picker so they all look and behave the same.
 */
export function PickerSheet({ title, query, onQuery, placeholder, onClose, children }: {
  title: string;
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useScrollLock(true);
  return (
    <Portal>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.55)' }}/>
      <div role="dialog" aria-label={title} style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 401, maxHeight: '78dvh',
        display: 'flex', flexDirection: 'column', borderRadius: '20px 20px 0 0',
        background: 'rgba(var(--bg-rgb), .99)', border: '1px solid rgba(var(--fg-rgb), .12)', borderBottom: 'none',
        boxShadow: '0 -18px 50px rgba(0,0,0,.5)', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 99, background: 'rgba(var(--fg-rgb), .2)', margin: '8px auto 0' }}/>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 8px' }}>
          <span style={{ color: btb.text, fontSize: 16, fontWeight: 800 }}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 10, border: btb.borderSoft, background: 'rgba(var(--fg-rgb), .06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <Icon name="close" size={14} color={btb.textMuted}/>
          </button>
        </div>
        <div style={{ margin: '0 14px 8px', height: 44, padding: '0 12px', borderRadius: 12, border: btb.borderSoft, background: 'rgba(var(--fg-rgb), .055)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="search" size={15} color={btb.textMuted}/>
          {/* 16px text so iOS does not zoom the page when the box is tapped. */}
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder}
            style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: btb.text, fontFamily: 'inherit', fontSize: 16 }}/>
        </div>
        <div style={{ overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 8px 10px' }}>{children}</div>
      </div>
    </Portal>
  );
}
