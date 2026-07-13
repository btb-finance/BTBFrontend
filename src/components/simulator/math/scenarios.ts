/**
 * Downside / central / upside scenario generation.
 *
 * The cards are coherent one-standard-deviation bands in log price space:
 * below −1σ, within ±1σ, and above +1σ. Their representative prices sit on
 * those boundaries, and their probabilities always sum to 100%.
 *
 * Recent drift is deliberately not used as a forecast. A short historical
 * trend is not reliable evidence of the next horizon's direction.
 */
import { normCdf } from './probability';

export interface Scenario {
  key: 'bear' | 'sideways' | 'bull';
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
  /** Kept for call-site compatibility; not used as a directional forecast. */
  _driftDaily: number,
): Scenario[] {
  const s = Math.max(sigmaDaily * Math.sqrt(Math.max(horizonDays, 1)), 1e-6);
  const pBear = normCdf(-1);
  const pBull = 1 - normCdf(1);
  const pSide = Math.max(0, 1 - pBear - pBull);

  return [
    { key: 'bear', label: 'Downside', endPrice: dispPrice * Math.exp(-s), probability: pBear },
    { key: 'sideways', label: 'Central range', endPrice: dispPrice, probability: pSide },
    { key: 'bull', label: 'Upside', endPrice: dispPrice * Math.exp(s), probability: pBull },
  ];
}
