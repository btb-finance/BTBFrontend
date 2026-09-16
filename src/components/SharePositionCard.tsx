'use client';
import { useEffect, useRef, useState } from 'react';
import { Portal } from './Portal';
import { Button } from './Button';
import { Icon } from './Icon';
import { btb } from './design-tokens';

/**
 * A 1200 x 630 PNG of one LP position, drawn on a canvas in the browser so
 * nothing leaves the device until the user downloads or copies it. Same
 * card in both colour modes: it is meant for a timeline, not for the app.
 */
export interface ShareCardData {
  pair: string;               // "WETH / USDC"
  dexLabel: string;           // "Uniswap V3"
  chainName: string;          // "Base"
  feeTierLabel: string;       // "0.05%"
  inRange: boolean;
  feesEarnedUsd: number;      // claimed + pending
  /** Staked positions: the hero shows the reward token amount instead of a USD figure. */
  hero?: { label: string; value: string };
  feesPer30dUsd?: number;
  aprPct?: number;
  pnlUsd?: number;
  vsHodlUsd?: number;
  depositUsd?: number;
  valueUsd?: number;
  ageMs?: number;
  logo0?: string;
  logo1?: string;
  symbol0: string;
  symbol1: string;
  /** Chain facts, always available: shown when the analytics provider has nothing for this chain. */
  holdings?: string;           // "0.42 ETH + 1.2M DEEP"
  unclaimedFees?: string;      // "0.0072 ETH + 16.3K DEEP"
  rangeLabel?: string;         // "1.79M to 1.79M DEEP/ETH"
  priceNow?: string;           // "1.79M DEEP/ETH"
  positionId?: string;
}

const W = 1200, H = 630;

function money(n: number, digits = 2): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(2)}M` : abs >= 10_000 ? abs.toLocaleString('en-US', { maximumFractionDigits: 0 }) : abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${n < 0 ? '-' : ''}$${s}`;
}
function signed(n: number): string { return `${n >= 0 ? '+' : ''}${money(n)}`; }
function age(ms: number): string {
  const d = Math.floor(ms / 86_400_000); const h = Math.floor((ms % 86_400_000) / 3_600_000); const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Largest font size (down to `min`) at which `text` fits in `maxW`. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number, min: number): number {
  let px = size;
  const font = (n: number) => `${weight} ${n}px -apple-system, "SF Pro Display", Inter, system-ui, sans-serif`;
  ctx.font = font(px);
  while (px > min && ctx.measureText(text).width > maxW) { px -= 2; ctx.font = font(px); }
  return px;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawTokenCircle(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, symbol: string, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  if (img) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, '#3a3f55'); g.addColorStop(1, '#1b1e2c');
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(r * 0.95)}px -apple-system, "SF Pro Display", Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((symbol[0] ?? '?').toUpperCase(), cx, cy + 1);
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = '#0A0A0F'; ctx.lineWidth = 6; ctx.stroke();
}

export async function renderShareCard(d: ShareCardData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const [logo, img0, img1] = await Promise.all([loadImage('/btblogo.jpg'), d.logo0 ? loadImage(d.logo0) : null, d.logo1 ? loadImage(d.logo1) : null]);
  const font = (weight: number, size: number) => `${weight} ${size}px -apple-system, "SF Pro Display", Inter, system-ui, sans-serif`;
  const green = '#52E3A4', muted = 'rgba(255,255,255,0.55)', dim = 'rgba(255,255,255,0.38)';

  // Background: near black with a soft green glow top right and a faint grid.
  ctx.fillStyle = '#0A0A0F'; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W - 120, -60, 20, W - 120, -60, 700);
  glow.addColorStop(0, 'rgba(82,227,164,0.28)'); glow.addColorStop(1, 'rgba(82,227,164,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(80, H + 40, 20, 80, H + 40, 520);
  glow2.addColorStop(0, 'rgba(255,255,255,0.10)'); glow2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow2; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // Card border
  roundRect(ctx, 1, 1, W - 2, H - 2, 34); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.stroke();

  // Header: BTB logo + name, handle right.
  if (logo) { ctx.save(); ctx.beginPath(); ctx.arc(84, 78, 26, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(logo, 58, 52, 52, 52); ctx.restore(); }
  ctx.fillStyle = '#fff'; ctx.font = font(800, 30); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('BTB Finance', 124, 78);
  ctx.fillStyle = muted; ctx.font = font(600, 22); ctx.textAlign = 'right'; ctx.fillText('@BTB_Finance', W - 60, 78);

  // Pair row with token logos.
  drawTokenCircle(ctx, img0, d.symbol0, 92, 172, 30);
  drawTokenCircle(ctx, img1, d.symbol1, 134, 172, 30);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  fitFont(ctx, d.pair, 800, 56, W - 186 - 60 - 200, 30);
  ctx.fillText(d.pair, 186, 170);
  const pairW = ctx.measureText(d.pair).width;
  // Status pill after the pair.
  const pill = d.inRange ? 'IN RANGE' : 'OUT OF RANGE';
  ctx.font = font(800, 16); const pw = ctx.measureText(pill).width + 28;
  roundRect(ctx, 186 + pairW + 22, 156, pw, 32, 16);
  ctx.fillStyle = d.inRange ? 'rgba(82,227,164,0.18)' : 'rgba(255,179,107,0.18)'; ctx.fill();
  ctx.fillStyle = d.inRange ? green : '#FFB36B'; ctx.textAlign = 'center'; ctx.fillText(pill, 186 + pairW + 22 + pw / 2, 172);
  ctx.textAlign = 'left'; ctx.fillStyle = muted; ctx.font = font(600, 22);
  ctx.fillText(`${d.dexLabel}  ·  ${d.feeTierLabel}  ·  ${d.chainName}`, 186, 214);

  // Hero: fees earned.
  const heroLabel = d.hero?.label ?? 'FEES EARNED';
  const heroValue = d.hero?.value ?? money(d.feesEarnedUsd);
  ctx.fillStyle = dim; ctx.font = font(800, 18); ctx.fillText(heroLabel, 62, 258);
  ctx.fillStyle = green; ctx.textBaseline = 'alphabetic';
  const has30d = !d.hero && d.feesPer30dUsd != null && d.feesPer30dUsd > 0;
  fitFont(ctx, heroValue, 900, 104, W - 120 - (has30d ? 260 : 0), 56);
  ctx.fillText(heroValue, 58, 362);
  if (has30d) {
    const heroW = ctx.measureText(heroValue).width;
    const t = `${money(d.feesPer30dUsd!, 0)} / 30d`;
    ctx.font = font(800, 24); const tw = ctx.measureText(t).width + 36;
    roundRect(ctx, 58 + heroW + 26, 314, tw, 48, 24); ctx.fillStyle = 'rgba(82,227,164,0.14)'; ctx.fill();
    ctx.strokeStyle = 'rgba(82,227,164,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = green; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(t, 58 + heroW + 26 + tw / 2, 339);
    ctx.textAlign = 'left';
  }

  // Stats grid.
  // Stats grid: three columns, two rows. Provider analytics first; when they
  // are missing (chains Krystal does not index) the chain facts fill the grid.
  const stats: { label: string; value: string; color: string }[] = [];
  if (d.depositUsd != null && d.depositUsd > 0) stats.push({ label: 'INVESTED', value: money(d.depositUsd), color: '#fff' });
  if (d.aprPct != null) stats.push({ label: 'APR', value: `${d.aprPct.toFixed(2)}%`, color: green });
  if (d.pnlUsd != null) stats.push({ label: 'PNL', value: signed(d.pnlUsd), color: d.pnlUsd >= 0 ? green : '#FF6B7A' });
  if (d.vsHodlUsd != null) stats.push({ label: 'VS HODL', value: signed(d.vsHodlUsd), color: d.vsHodlUsd >= 0 ? green : '#FF6B7A' });
  if (d.ageMs != null) stats.push({ label: 'AGE', value: age(d.ageMs), color: '#fff' });
  if (d.valueUsd != null && d.valueUsd >= 1) stats.push({ label: 'VALUE NOW', value: money(d.valueUsd), color: '#fff' });
  if (stats.length < 6 && d.holdings) stats.push({ label: 'HOLDINGS', value: d.holdings, color: '#fff' });
  if (stats.length < 6 && d.unclaimedFees && d.hero) stats.push({ label: 'UNCLAIMED', value: d.unclaimedFees, color: green });
  if (stats.length < 6 && d.priceNow) stats.push({ label: 'PRICE NOW', value: d.priceNow, color: '#fff' });
  if (stats.length < 6 && d.rangeLabel) stats.push({ label: 'RANGE', value: d.rangeLabel, color: '#fff' });
  if (stats.length < 6 && d.positionId) stats.push({ label: 'POSITION', value: `#${d.positionId}`, color: '#fff' });
  stats.slice(0, 6).forEach((s, i) => {
    const x = 62 + (i % 3) * 370; const y = 412 + Math.floor(i / 3) * 74;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = dim; ctx.font = font(800, 16); ctx.fillText(s.label, x, y);
    ctx.fillStyle = s.color; fitFont(ctx, s.value, 900, 38, 330, 22); ctx.fillText(s.value, x, y + 34);
  });

  // Footer.
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, H - 60, W, 1);
  ctx.textBaseline = 'middle'; ctx.fillStyle = muted; ctx.font = font(700, 20); ctx.textAlign = 'left';
  ctx.fillText('Free LP simulator, discovery and management. Revenue shared every Friday.', 62, H - 30);
  ctx.fillStyle = '#fff'; ctx.font = font(800, 24); ctx.textAlign = 'right'; ctx.fillText('btb.finance', W - 60, H - 30);
  return canvas;
}

export function SharePositionCard({ data, onClose }: { data: ShareCardData; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let live = true;
    renderShareCard(data).then((c) => { if (!live) return; canvasRef.current = c; setUrl(c.toDataURL('image/png')); });
    return () => { live = false; };
  }, [data]);

  const file = `btb-${data.symbol0}-${data.symbol1}.png`;
  async function copy() {
    const c = canvasRef.current; if (!c) return;
    try {
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch {}
  }
  const tweet = `${data.pair} on ${data.dexLabel} (${data.chainName}): ${data.hero ? `${data.hero.value} earned` : `${money(data.feesEarnedUsd)} in fees`}${data.aprPct != null ? `, ${data.aprPct.toFixed(1)}% APR` : ''}. Managed on @BTB_Finance, free. btb.finance/simulate`;

  return (
    <Portal>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 420, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px 16px', overflowY: 'auto' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, background: btb.bg, border: btb.border, borderRadius: 24, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ color: btb.text, fontSize: 17, fontWeight: 800 }}>Share this position</div>
            <div onClick={onClose} style={{ cursor: 'pointer' }}><Icon name="close" size={16} color={btb.textMuted}/></div>
          </div>
          <div style={{ borderRadius: 16, overflow: 'hidden', border: btb.borderSoft, background: '#0A0A0F', aspectRatio: '1200 / 630' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {url ? <img src={url} alt={`${data.pair} position card`} style={{ width: '100%', height: '100%', display: 'block' }}/> : <div style={{ color: btb.textDim, fontSize: 13, padding: 20 }}>Rendering…</div>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <a href={url ?? '#'} download={file} style={{ textDecoration: 'none', flex: 1, minWidth: 140 }}>
              <Button variant="success" size="md" fullWidth disabled={!url}>Download PNG</Button>
            </a>
            <Button variant="ghost" size="md" onClick={copy} disabled={!url} style={{ flex: 1, minWidth: 140 }}>{copied ? 'Copied' : 'Copy image'}</Button>
            <a href={`https://x.com/intent/post?text=${encodeURIComponent(tweet)}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', flex: 1, minWidth: 140 }}>
              <Button variant="ghost" size="md" fullWidth>Post on X</Button>
            </a>
          </div>
          <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
            Copy the image, then paste it into the post. Rendered on your device; nothing is uploaded.
          </div>
        </div>
      </div>
    </Portal>
  );
}
