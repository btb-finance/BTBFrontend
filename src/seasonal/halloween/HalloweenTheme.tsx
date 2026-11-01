'use client';
/**
 * Seasonal Halloween theme. Everything for it lives in this folder.
 *
 * TO REMOVE: delete src/seasonal/halloween/ and the two lines marked
 * "HALLOWEEN" in src/components/AppShell.tsx. Nothing else references it.
 * (design-tokens.ts reads an optional --btb-cta-gradient that this theme sets;
 * once the theme is gone it falls back to the normal green, so it can stay.)
 */
import { useEffect } from 'react';
import './halloween.css';

const CLASS = 'btb-halloween';

function Bat({ className }: { className: string }) {
  return (
    <svg className={`btb-hw-bat ${className}`} viewBox="0 0 64 28" aria-hidden="true">
      <path d="M32 9c-1.2-2.6-2.4-3.6-3-3.6.3 1.4.1 2.6-.4 3.4C25 6.3 19 2 9 1c3 2.3 4 5 3.6 7.4C9 7.6 4.6 8 0 10.6c5.6.4 9.4 3 11 6.4 2.4-1.6 5.6-1.6 8 .6.8-2 3.4-3.4 6-3 .6 1.8 3.4 6 7 9 3.6-3 6.4-7.2 7-9 2.6-.4 5.2 1 6 3 2.4-2.2 5.6-2.2 8-.6 1.6-3.4 5.4-6 11-6.4C59.4 8 55 7.6 51.4 8.4 51 6 52 3.3 55 1 45 2 39 6.3 35.4 8.8c-.5-.8-.7-2-.4-3.4-.6 0-1.8 1-3 3.6z"/>
    </svg>
  );
}

function Web() {
  return (
    <svg className="btb-hw-web" viewBox="0 0 120 120" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="0.8">
        <path d="M0 0L120 40M0 0L95 95M0 0L40 120M0 0L120 0M0 0L0 120"/>
        <path d="M30 0Q26 6 29 10Q24 18 10 29Q6 26 0 30"/>
        <path d="M60 0Q52 12 58 20Q48 38 20 58Q12 52 0 60"/>
        <path d="M90 0Q78 18 87 30Q72 58 30 87Q18 78 0 90"/>
      </g>
      <line x1="58" y1="20" x2="58" y2="52" stroke="currentColor" strokeWidth="0.6"/>
      <g className="btb-hw-spider">
        <ellipse cx="58" cy="56" rx="4" ry="5"/>
        <circle cx="58" cy="50" r="2.6"/>
        <path d="M54 54l-6-4M54 57l-7 0M54 60l-6 4M62 54l6-4M62 57l7 0M62 60l6 4" stroke="currentColor" strokeWidth="1" fill="none"/>
      </g>
    </svg>
  );
}

function Pumpkin() {
  return (
    <svg className="btb-hw-pumpkin" viewBox="0 0 64 56" aria-hidden="true">
      <path d="M31 10c0-5 2-8 6-9" stroke="#3E6B2B" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <ellipse cx="18" cy="33" rx="15" ry="20" fill="#E8641B"/>
      <ellipse cx="46" cy="33" rx="15" ry="20" fill="#E8641B"/>
      <ellipse cx="32" cy="33" rx="14" ry="22" fill="#FF7A1F"/>
      <path d="M20 28l5-6 5 6zM34 28l5-6 5 6z" fill="#FFD25E"/>
      <path d="M18 38q14 12 28 0l-4 1-2 4-3-3-3 4-3-4-3 3-2-4z" fill="#FFD25E"/>
    </svg>
  );
}

export function HalloweenTheme() {
  // The colour overrides key off this class on <html>, so unmounting the
  // component (or deleting it) puts the normal theme straight back.
  useEffect(() => {
    document.documentElement.classList.add(CLASS);
    return () => document.documentElement.classList.remove(CLASS);
  }, []);

  return (
    <div className="btb-hw-layer" aria-hidden="true">
      <Web/>
      <Bat className="btb-hw-bat1"/>
      <Bat className="btb-hw-bat2"/>
      <Bat className="btb-hw-bat3"/>
      <Pumpkin/>
    </div>
  );
}
