/**
 * Position health score — one 0 to 100 number summarising how sound the
 * configured position is, plus the factor breakdown so the UI can explain
 * WHY instead of showing an unexplained grade.
 */

export interface HealthFactor {
  name: string;
  /** 0..100, higher = healthier. */
  score: number;
  /** Contribution weight, sums to 1 across factors. */
  weight: number;
  /** One-line plain explanation of the current reading. */
  note: string;
}

export interface Health {
  score: number;          // 0..100 weighted total
  emoji: string;          // 🟢 / 🟡 / 🔴
  color: string;          // matching accent hex
  factors: HealthFactor[];
  /** The weakest factor's note — the one thing to fix first (null when all strong). */
  topIssue: string | null;
}

export interface HealthInput {
  price: number;
  priceLower: number;
  priceUpper: number;
  /** P(price still in range at horizon), 0..1. */
  coverage: number;
  /** Fees-only APR, percent. */
  feeAprPct: number;
  /** Expected IL at the horizon as a signed fraction (≤ 0 usually). */
  expectedIlFraction: number;
  /** Expected fee return over the horizon as a fraction of the deposit. */
  expectedFeeFraction: number;
  tvlUsd: number | null;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function healthScore(i: HealthInput): Health {
  // 1 · Price placement (40%): distance from the nearer range edge, log space.
  //     1 = perfectly centered, 0 = at an edge or outside.
  let placement = 0;
  let placementNote = 'Price is outside your range. The position earns nothing until it returns.';
  if (i.price >= i.priceLower && i.price <= i.priceUpper && i.priceUpper > i.priceLower) {
    const half = Math.log(i.priceUpper / i.priceLower) / 2;
    const d = Math.min(Math.log(i.price / i.priceLower), Math.log(i.priceUpper / i.price));
    placement = clamp01(half > 0 ? d / half : 0);
    placementNote = placement > 0.6
      ? 'Price sits comfortably inside your range.'
      : placement > 0.25
        ? 'Price is drifting toward a range edge. Keep an eye on it.'
        : 'Price is very close to a range edge. One more move exits the range.';
  }

  // 2 · Staying power (25%): probability the price is still in range at the
  //     horizon. 80%+ coverage earns full marks.
  const staying = clamp01(i.coverage / 0.8);
  const stayingNote = i.coverage >= 0.6
    ? `About ${Math.round(i.coverage * 100)}% odds the price is still in range at the horizon.`
    : `Only about ${Math.round(i.coverage * 100)}% odds the price is still in range at the horizon. A wider range would hold longer.`;

  // 3 · Fees vs IL (20%): expected fees should clear expected IL with room to
  //     spare. Fees at 2x the expected IL = full marks.
  const ilMag = Math.max(0, -i.expectedIlFraction);
  const feeVsIl = ilMag <= 1e-6 ? 1 : clamp01(i.expectedFeeFraction / (2 * ilMag));
  const feeVsIlNote = feeVsIl >= 0.75
    ? 'Expected fees comfortably outrun expected impermanent loss.'
    : feeVsIl >= 0.4
      ? 'Expected fees beat expected impermanent loss, but not by much.'
      : 'Expected impermanent loss eats most of the fee income at this setting.';

  // 4 · Pool depth (15%): log-scaled TVL. $10M+ = full marks, $10k or less = 0.
  const depth = i.tvlUsd == null ? 0.5 : clamp01((Math.log10(Math.max(i.tvlUsd, 1)) - 4) / 3);
  const depthNote = i.tvlUsd == null
    ? 'Pool TVL unknown, treated as neutral.'
    : depth >= 0.66
      ? 'Deep pool. Fee income tends to be steadier here.'
      : 'Shallow pool. APRs here can swing or vanish quickly.';

  const factors: HealthFactor[] = [
    { name: 'Price placement', score: Math.round(placement * 100), weight: 0.4, note: placementNote },
    { name: 'Staying power', score: Math.round(staying * 100), weight: 0.25, note: stayingNote },
    { name: 'Fees vs IL', score: Math.round(feeVsIl * 100), weight: 0.2, note: feeVsIlNote },
    { name: 'Pool depth', score: Math.round(depth * 100), weight: 0.15, note: depthNote },
  ];

  const score = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0));
  const weakest = [...factors].sort((a, b) => a.score - b.score)[0];

  return {
    score,
    emoji: score >= 70 ? '🟢' : score >= 40 ? '🟡' : '🔴',
    color: score >= 70 ? '#52E3A4' : score >= 40 ? '#FFB36B' : '#FF6B7A',
    factors,
    topIssue: weakest.score < 60 ? weakest.note : null,
  };
}
