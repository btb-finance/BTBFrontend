'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Portal } from '../components/Portal';
import { Icon } from '../components/Icon';
import { btb } from '../components/design-tokens';

type XpToast = { id: number; amount: number; reason: string; sub: string };

const Ctx = createContext<(amount: number, reason: string, sub?: string) => void>(() => {});

/** Show a small "+N XP" pill; `amount <= 0` is ignored so award sites can pass
 * the server's result straight through (a once-a-day repeat awards 0). */
export function useXpToast() { return useContext(Ctx); }

const DEFAULT_SUB = "Counts toward Friday's BTB split";

export function XpToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<XpToast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((amount: number, reason: string, sub: string = DEFAULT_SUB) => {
    if (!(amount > 0)) return;
    const id = ++nextId.current;
    setToasts(t => [...t.slice(-2), { id, amount, reason, sub }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {toasts.length > 0 && (
        <Portal>
          <div style={{ position: 'fixed', top: 'max(14px, env(safe-area-inset-top))', left: 0, right: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
            {toasts.map(t => <Pill key={t.id} toast={t}/>)}
          </div>
        </Portal>
      )}
    </Ctx.Provider>
  );
}

function Pill({ toast }: { toast: XpToast }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const f = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(f); }, []);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px 9px 10px', borderRadius: 999,
      background: 'rgba(12,20,16,0.92)', border: '1px solid rgba(82,227,164,0.45)', boxShadow: btb.shadow,
      backdropFilter: btb.blur, WebkitBackdropFilter: btb.blur,
      transform: shown ? 'translateY(0)' : 'translateY(-12px)', opacity: shown ? 1 : 0, transition: 'transform .25s ease, opacity .25s ease',
    }}>
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(82,227,164,0.18)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="star" size={14} color={btb.green}/>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span style={{ color: btb.text, fontSize: 13, fontWeight: 800 }}>
          <b style={{ color: btb.green }}>+{toast.amount} XP</b> · {toast.reason}
        </span>
        <span style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 2 }}>{toast.sub}</span>
      </span>
    </div>
  );
}
