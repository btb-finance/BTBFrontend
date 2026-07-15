'use client';

import { btb } from './design-tokens';

const ROBINHOOD_GREEN = '#00C805';

/**
 * Top-of-Discover status strip: signals that BTB's agent automation is live on Robinhood Chain.
 * Purely presentational — a confidence cue, not a data source.
 */
export function DiscoverStatusBanner({ isMobile = false }: { isMobile?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 10 : 14,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        padding: isMobile ? '11px 13px' : '12px 16px',
        borderRadius: 14,
        border: `1px solid ${ROBINHOOD_GREEN}33`,
        background: `linear-gradient(100deg, ${ROBINHOOD_GREEN}1f, rgba(255,255,255,0.02) 55%)`,
      }}
    >
      <style>{`@keyframes btbLivePulse{0%{box-shadow:0 0 0 0 ${ROBINHOOD_GREEN}66}70%{box-shadow:0 0 0 6px ${ROBINHOOD_GREEN}00}100%{box-shadow:0 0 0 0 ${ROBINHOOD_GREEN}00}}`}</style>

      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: ROBINHOOD_GREEN, animation: 'btbLivePulse 1.8s ease-out infinite' }} />
        <span style={{ color: btb.text, fontSize: 12.5, fontWeight: 850, letterSpacing: 0.2 }}>Automation live</span>
      </span>

      <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', flexShrink: 0, display: isMobile ? 'none' : 'block' }} />

      <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: ROBINHOOD_GREEN, flexShrink: 0 }} />
        <span style={{ color: btb.text, fontSize: 12.5, fontWeight: 750 }}>Robinhood Chain</span>
      </span>

      <span style={{ color: btb.textMuted, fontSize: 11, lineHeight: 1.35, flex: 1, minWidth: isMobile ? '100%' : 0 }}>
        Agent-managed rebalancing, compounding and one-click zaps run non-custodially on Robinhood Chain.
      </span>
    </div>
  );
}
