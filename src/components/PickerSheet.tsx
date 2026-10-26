'use client';
import type { ReactNode } from 'react';
import { Portal } from './Portal';
import { Icon } from './Icon';
import { btb } from './design-tokens';
import { useScrollLock } from '../lib/useScrollLock';
import { useSidebar } from '../lib/SidebarContext';

/**
 * A picker with a title, a search box and a scrolling list, laid out like Wind Swap's token selector: a sheet from
 * the bottom on a phone, a centred card on a wider screen. The page behind stays still. Shared by every picker so
 * they all look and behave the same; `footer` is an optional line under the list.
 */
export function PickerSheet({ title, query, onQuery, placeholder, onClose, children, footer }: {
  title: string;
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useScrollLock(true);
  const { isMobile } = useSidebar();
  return (
    <Portal>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}/>
      <div role="dialog" aria-label={title} style={{
        position: 'fixed', zIndex: 401, display: 'flex', flexDirection: 'column',
        background: 'rgba(var(--bg-rgb), .99)', border: '1px solid rgba(var(--fg-rgb), .12)', boxShadow: '0 24px 60px rgba(0,0,0,.55)',
        ...(isMobile
          ? { left: 0, right: 0, bottom: 0, maxHeight: '82dvh', borderRadius: '24px 24px 0 0', borderBottom: 'none', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }
          : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(440px, calc(100vw - 32px))', maxHeight: '80vh', borderRadius: 24 }),
      }}>
        {isMobile && <div style={{ width: 44, height: 4, borderRadius: 99, background: 'rgba(var(--fg-rgb), .2)', margin: '8px auto 0' }}/>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '10px 18px 12px' : '20px 22px 14px' }}>
          <span style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.3 }}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 36, height: 36, borderRadius: 11, border: 'none', background: 'rgba(var(--fg-rgb), .06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <Icon name="close" size={14} color={btb.textMuted}/>
          </button>
        </div>
        <div style={{ margin: isMobile ? '0 18px 12px' : '0 22px 14px', height: 46, padding: '0 14px', borderRadius: 14, border: '1px solid rgba(var(--fg-rgb), .1)', background: 'rgba(var(--fg-rgb), .05)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="search" size={15} color={btb.textMuted}/>
          {/* 16px text so iOS does not zoom the page when the box is tapped. */}
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder}
            style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: btb.text, fontFamily: 'inherit', fontSize: 16 }}/>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: isMobile ? '0 10px 10px' : '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
        {footer && (
          <div style={{ borderTop: '1px solid rgba(var(--fg-rgb), .07)', padding: isMobile ? '12px 18px' : '14px 22px', color: btb.textDim, fontSize: 12, textAlign: 'center' }}>{footer}</div>
        )}
      </div>
    </Portal>
  );
}

/**
 * One token in a picker, in Wind Swap's row style: the logo in a soft circle, symbol over name, balance over its
 * dollar value, and the current choice outlined.
 */
export function PickerTokenRow({ icon, symbol, name, balance, usd, selected, onClick }: {
  icon: ReactNode; symbol: string; name?: string; balance?: string; usd?: string; selected?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      border: selected ? '1px solid rgba(var(--green-rgb), 0.35)' : '1px solid transparent',
      background: selected ? 'rgba(var(--green-rgb), 0.1)' : 'transparent',
    }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'rgba(var(--fg-rgb), 0.05)'; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(var(--green-rgb), 0.18), rgba(var(--fg-rgb), 0.06))' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', color: btb.text, fontSize: 15, fontWeight: 800 }}>{symbol}</span>
        {name && <span style={{ display: 'block', color: btb.textMuted, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>}
      </span>
      {(balance || usd) && (
        <span style={{ textAlign: 'right', flexShrink: 0 }}>
          {balance && <span style={{ display: 'block', color: btb.text, fontSize: 13.5, fontWeight: 700 }}>{balance}</span>}
          {usd && <span style={{ display: 'block', color: btb.textDim, fontSize: 11.5 }}>{usd}</span>}
        </span>
      )}
    </button>
  );
}
