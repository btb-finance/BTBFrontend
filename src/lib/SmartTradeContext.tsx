'use client';
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TradePreset, TradeStatus } from '@/components/SmartTradePanel';

/**
 * Trade state shared between Home and the Trade tab.
 *
 * The market rows on Home start a trade, but the panel that executes it lives
 * on another screen, so the queue and its live status have to sit above both.
 * Keeping it here also means a trade survives navigating between the two.
 */
type SmartTrade = {
  presets: TradePreset[];
  tradeStatus: TradeStatus | null;
  setTradeStatus: (status: TradeStatus | null) => void;
  selectTrade: (market: { address: string; symbol: string; imageUrl?: string }, side: 'buy' | 'sell') => void;
  tradeButtonState: (address: string, side: 'buy' | 'sell') => { label: string; disabled: boolean };
};

const Ctx = createContext<SmartTrade | null>(null);

export function SmartTradeProvider({ children }: { children: ReactNode }) {
  const [presets, setPresets] = useState<TradePreset[]>([]);
  const [tradeStatus, setTradeStatus] = useState<TradeStatus | null>(null);
  const presetMeta = useRef(new Map<string, { address: string; side: 'buy' | 'sell' }>());

  const value = useMemo<SmartTrade>(() => ({
    presets,
    tradeStatus,
    setTradeStatus,
    selectTrade(market, side) {
      // Ignore a repeat tap on a button whose trade is still working — prevents
      // accidental duplicate orders. Deliberate repeats go through "Buy again".
      if (tradeStatus?.phase === 'working') {
        const active = presetMeta.current.get(tradeStatus.id);
        if (active && active.address === market.address.toLowerCase() && active.side === side) return;
      }
      const id = `trade:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
      presetMeta.current.set(id, { address: market.address.toLowerCase(), side });
      setPresets(current => [...current, {
        id, side, address: market.address as `0x${string}`, symbol: market.symbol, imageUrl: market.imageUrl,
      }].slice(-100));
    },
    // Label + disabled state for a market's Buy/Dump button, driven by the
    // panel's live status so the tapped button shows progress instead of idling.
    tradeButtonState(address, side) {
      const meta = tradeStatus ? presetMeta.current.get(tradeStatus.id) : null;
      const mine = meta && meta.address === address.toLowerCase() && meta.side === side;
      const label = side === 'buy' ? 'Buy' : 'Dump';
      if (!mine || !tradeStatus) return { label, disabled: false };
      if (tradeStatus.phase === 'working') return { label: side === 'buy' ? 'Buying…' : 'Selling…', disabled: true };
      if (tradeStatus.phase === 'confirmed') return { label: side === 'buy' ? 'Bought' : 'Sold', disabled: false };
      return { label, disabled: false };
    },
  }), [presets, tradeStatus]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSmartTrade(): SmartTrade {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSmartTrade must be used inside SmartTradeProvider');
  return ctx;
}
