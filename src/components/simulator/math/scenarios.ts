/**
 * Bear / Sideways / Bull scenario generation.
 *
 * Boundaries are set at ±0.5σ over the horizon (in log space) so "sideways"
 * means what people mean by it: the price stayed within roughly half a
 * standard deviation. Probabilities integrate the same lognormal model the
 * rest of the simulator uses — they always sum to 100%.
 *
 * A shrunk, clamped historical drift tilts the probabilities toward the recent
 * trend (a pair that ground down for 30 days should not show a symmetric
 * outlook), while the representative prices stay at clean −1σ / median / +1σ
 * points so the three cards are comparable across pools.
 */
import { normCdf } from './probability';

export interface Scenario {
  key: 'bear' | 'sideways' | 'bull';
  emoji: string;
  label: string;
  /** Representative end price for the scenario, DISPLAY orientation. */
  endPrice: number;
  /** Probability of ending in this scenario's band, 0..1. */
  probability: number;
}

export function buildScenarios(
  /** Current price in DISPLAY orientation (volatile token quoted in the other). */
  dispPrice: number,
  sigmaDaily: number,
  horizonDays: number,
  /** Historical daily drift in DISPLAY orientation (sign matters). */
  driftDaily: number,
): Scenario[] {
  const s = Math.max(sigmaDaily * Math.sqrt(Math.max(horizonDays, 1)), 1e-6);
  // Half-strength drift, clamped to ±0.75σ — enough to tilt the odds with the
  // trend, never enough for the model to claim near-certainty either way.
  const mu = Math.max(-0.75 * s, Math.min(0.75 * s, 0.5 * driftDaily * horizonDays));

  const pBear = normCdf((-0.5 * s - mu) / s);
  const pBull = 1 - normCdf((0.5 * s - mu) / s);
  const pSide = Math.max(0, 1 - pBear - pBull);

  return [
    { key: 'bear', emoji: '🐻', label: 'Bear', endPrice: dispPrice * Math.exp(mu - s), probability: pBear },
    { key: 'sideways', emoji: '😐', label: 'Sideways', endPrice: dispPrice * Math.exp(mu), probability: pSide },
    { key: 'bull', emoji: '🚀', label: 'Bull', endPrice: dispPrice * Math.exp(mu + s), probability: pBull },
  ];
}
