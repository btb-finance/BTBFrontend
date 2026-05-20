'use client';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { btb } from './design-tokens';
import { Icon } from './Icon';

export function ReceiveModal({ address, onClose }: { address: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    /* backdrop */
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      {/* sheet */}
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, minWidth: 0,
        maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden',
        background: 'rgba(28,4,10,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '28px 28px 0 0',
        padding: '12px 24px 44px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
      }}>
        {/* handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}/>

        {/* header */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: btb.text, fontSize: 20, fontWeight: 800, letterSpacing: -0.4 }}>Receive</span>
          <div onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(255,255,255,0.08)', border: btb.borderSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13"/>
            </svg>
          </div>
        </div>

        {/* QR card */}
        <div style={{
          background: '#fff',
          borderRadius: 24,
          padding: 20,
          boxShadow: '0 16px 48px rgba(255,255,255,0.12)',
          position: 'relative',
        }}>
          <QRCodeSVG
            value={address}
            size={220}
            bgColor="#ffffff"
            fgColor="#0A0A0F"
            level="M"
            imageSettings={{
              src: '', // placeholder — replace with BTB logo url if desired
              x: undefined,
              y: undefined,
              height: 0,
              width: 0,
              excavate: false,
            }}
          />
          {/* corner accents */}
          {[
            { top: 8, left: 8 },
            { top: 8, right: 8 },
            { bottom: 8, left: 8 },
            { bottom: 8, right: 8 },
          ].map((pos, i) => (
            <div key={i} style={{
              position: 'absolute', width: 20, height: 20,
              borderRadius: 4,
              border: '3px solid #FFFFFF',
              borderRight: pos.right !== undefined || (pos.left !== undefined && i % 2 === 0) ? undefined : 'none',
              borderLeft: pos.left !== undefined || (pos.right !== undefined && i % 2 === 1) ? undefined : 'none',
              borderBottom: pos.bottom !== undefined ? undefined : 'none',
              borderTop: pos.top !== undefined ? undefined : 'none',
              ...pos,
            }}/>
          ))}
        </div>

        {/* network badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 999,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52E3A4', boxShadow: '0 0 6px #52E3A4' }}/>
          <span style={{ color: btb.textMuted, fontSize: 12, fontWeight: 600 }}>Ethereum Mainnet</span>
        </div>

        {/* address row */}
        <div style={{
          width: '100%',
          background: 'rgba(255,255,255,0.05)',
          border: btb.border,
          borderRadius: 16,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{
            flex: 1, color: btb.textMuted, fontSize: 13, fontWeight: 500,
            fontFamily: 'monospace', letterSpacing: 0.3,
            wordBreak: 'break-all', lineHeight: 1.5,
          }}>
            {address}
          </span>
          <button onClick={copy} style={{
            flexShrink: 0,
            height: 40, padding: '0 14px',
            borderRadius: 12,
            border: 'none', cursor: 'pointer',
            background: copied
              ? 'rgba(82,227,164,0.18)'
              : 'linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))',
            color: copied ? '#52E3A4' : '#fff',
            fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'background 0.2s, color 0.2s',
            boxShadow: copied ? 'none' : '0 4px 16px rgba(255,255,255,0.18)',
          }}>
            {copied
              ? <><Icon name="check" size={14} color="#52E3A4"/>Copied</>
              : <><Icon name="qr" size={14} color="#fff"/>Copy</>
            }
          </button>
        </div>

        <p style={{ color: btb.textDim, fontSize: 12, textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
          Send only ETH and ERC-20 tokens to this address.<br/>
          Sending other assets may result in permanent loss.
        </p>
      </div>
    </div>
  );
}
