/**
 * Price probability model for the LP simulator — lognormal price at a horizon,
 * parameterised from the pool's own recent daily history.
 *
 * Everything here is display-grade float math (same convention as
 * v3/simulate.ts): it powers charts and probabilities shown to the user, never
 * a transaction. The model is deliberately simple and stated as such in the UI:
 * daily log returns are assumed i.i.d. normal, so the price at day T is
 * lognormal with σ_T = σ_daily·√T around today's price (zero drift for the
 * headline numbers — scenario probabilities may add a shrunk historical drift).
 */

/** Standard normal CDF via the Abramowitz & Stegun erf approximation (~1e-7). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

/** Standard normal PDF. */
export function normPdf(z: number): number {
  return Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
}

/**
 * Daily log-return volatility from a close series (any consistent orientation —
 * inverting the price series only flips the sign of each return, σ is the same).
 * Falls back to a broad-crypto default when the series is too short to say
 * anything, and clamps to a sane band so one bad candle can't explode the model.
 */
export function estimateSigmaDaily(closes: number[]): number {
  const FALLBACK = 0.04; // ~4%/day — typical volatile-pair default
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (rets.length < 5) return FALLBACK;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const varSum = rets.reduce((s, r) => s + (r - mean) ** 2, 0);
  const sigma = Math.sqrt(varSum / (rets.length - 1));
  return Math.min(0.25, Math.max(0.001, sigma));
}

/** Mean daily log return of a close series (the historical drift). */
export function estimateDriftDaily(closes: number[]): number {
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (rets.length < 5) return 0;
  return rets.reduce((s, r) => s + r, 0) / rets.length;
}

/** P(price ∈ [lower, upper] at day T), price today = p0, zero-drift lognormal. */
export function rangeCoverage(p0: number, lower: number, upper: number, sigmaDaily: number, days: number, driftDaily = 0): number {
  if (!(p0 > 0) || !(lower > 0) || !(upper > lower) || !(sigmaDaily > 0) || !(days > 0)) return 0;
  const s = sigmaDaily * Math.sqrt(days);
  const mu = driftDaily * days;
  const zLo = (Math.log(lower / p0) - mu) / s;
  const zHi = (Math.log(upper / p0) - mu) / s;
  return Math.max(0, Math.min(1, normCdf(zHi) - normCdf(zLo)));
}

/**
 * Expected fraction of the horizon the price spends inside the range —
 * the average of the terminal coverage over intermediate days. A cheap but
 * honest stand-in for a full path simulation (it slightly overstates time in
 * range for a range the price starts outside of, which coverage(0)=0 offsets).
 */
export function expectedTimeInRange(p0: number, lower: number, upper: number, sigmaDaily: number, days: number, driftDaily = 0): number {
  if (!(days > 0)) return p0 >= lower && p0 <= upper ? 1 : 0;
  const STEPS = 12;
  let sum = 0;
  for (let i = 1; i <= STEPS; i++) {
    sum += rangeCoverage(p0, lower, upper, sigmaDaily, (days * i) / STEPS, driftDaily);
  }
  return sum / STEPS;
}

/**
 * Fraction of a straight-line (log-space) price path p0 → p1 that lies inside
 * [lower, upper]. Used to scale fee income for "what if price moves X%" views:
 * a move that exits the range early earns fees only while still inside.
 */
export function pathInRangeFraction(p0: number, p1: number, lower: number, upper: number): number {
  if (!(p0 > 0) || !(p1 > 0) || !(lower > 0) || !(upper > lower)) return 0;
  const a = Math.log(Math.min(p0, p1));
  const b = Math.log(Math.max(p0, p1));
  const lo = Math.log(lower), hi = Math.log(upper);
  if (b === a) return p0 >= lower && p0 <= upper ? 1 : 0;
  const overlap = Math.min(b, hi) - Math.max(a, lo);
  return Math.max(0, Math.min(1, overlap / (b - a)));
}
