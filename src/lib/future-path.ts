import { GENESIS_UTC, MS_PER_DAY, SIGMA, quantilePriceUsd } from "@/lib/powerlaw";

/**
 * Future path from Perrenod, “Disproving 4-Year Cycle Dominance” (Apr 2026).
 *
 * The power law is removed first. What is left is not a 4-year sine. The
 * residual in log10 price is three discrete-scale-invariant modes:
 *
 *   r(u) = d0 + Σ_{m∈{1,2,4}} [a_m cos(m ω u) + b_m sin(m ω u)]
 *   u = ln t,  t = days since the genesis block.
 *
 * ω = 8.74, so λ = e^{2π/ω} ≈ 2.05 (published band ω ≈ 8.6–8.8, λ ≈ 2.0–2.08).
 * Amplitudes are the least-squares fit of those fixed frequencies to this
 * chart’s power-law residuals through 8 Apr 2026, the article’s window.
 * That fit explains ~45% of the residual (the article’s three-mode R² is 0.44)
 * and crosses back above the power law in early April 2026, then rises.
 *
 * The line starts on the live print, then the gap to the model fades. Today's
 * discount is not frozen into the future — that was shoving a later dip down
 * onto the −2σ floor. After the fade, the path is the model's own residual,
 * which stays well above that floor.
 */

export const LP_OMEGA = 8.74;

const D0 = 0.0376;
const MODES: ReadonlyArray<readonly [number, number, number]> = [
  [1, -0.23452, 0.08885],
  [2, -0.06692, 0.01685],
  [4, 0.11768, -0.00113],
];

export type FuturePoint = { t: number; usd: number; z: number };

/** Log10-price residual of the three-mode DSI model, around this chart’s power law. */
export function logPeriodicResidual(t: number): number {
  if (!(t > 1)) return 0;
  const u = Math.log(t);
  let r = D0;
  for (const [m, a, b] of MODES) {
    const phase = m * LP_OMEGA * u;
    r += a * Math.cos(phase) + b * Math.sin(phase);
  }
  return r;
}

export function logPeriodicZ(t: number): number {
  return logPeriodicResidual(t) / SIGMA;
}

const JOIN_DAYS = 400;

function joinedZ(t: number, tNow: number, zNow: number): number {
  const model = logPeriodicZ(t);
  const gap = zNow - logPeriodicZ(tNow);
  const fade = Math.exp(-Math.max(0, t - tNow) / JOIN_DAYS);
  return model + gap * fade;
}

export function projectedUsd(t: number, tNow: number, zNow: number): number {
  return quantilePriceUsd(t, joinedZ(t, tNow, zNow));
}

export type FutureMark = {
  iso: string;
  t: number;
  label: string;
  tone: "bull" | "bear";
  usd: number;
};

function isoAt(t: number): string {
  const d = new Date(GENESIS_UTC + Math.round(t) * MS_PER_DAY);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Next crest and next trough of the log-periodic residual, within 12 years. */
export function futureEventMarks(tNow: number, zNow: number): FutureMark[] {
  if (!(tNow > 1) || !Number.isFinite(zNow)) return [];
  const horizon = tNow + Math.round(12 * 365.25);
  const step = 7;
  let prev = joinedZ(tNow, tNow, zNow);
  let prevSlope = 0;
  const hits: FutureMark[] = [];
  for (let t = tNow + step; t <= horizon; t += step) {
    const z = joinedZ(t, tNow, zNow);
    const slope = z - prev;
    if (prevSlope !== 0 && Math.sign(slope) !== Math.sign(prevSlope) && Math.abs(prevSlope) > 1e-6) {
      const crest = prevSlope > 0;
      const at = t - step;
      if (at > tNow + 30) {
        hits.push({
          iso: isoAt(at),
          t: at,
          label: crest ? "Log-periodic crest" : "Log-periodic trough",
          tone: crest ? "bull" : "bear",
          usd: projectedUsd(at, tNow, zNow),
        });
      }
    }
    prevSlope = slope;
    prev = z;
    if (hits.length >= 2) break;
  }
  return hits;
}

export function futurePricePath(tNow: number, zNow: number, tEnd: number, step = 6): FuturePoint[] {
  if (!(tEnd > tNow) || !(tNow > 1) || !Number.isFinite(zNow)) return [];
  const out: FuturePoint[] = [];
  for (let t = tNow; t <= tEnd; t += step) {
    const z = joinedZ(t, tNow, zNow);
    out.push({ t, z, usd: quantilePriceUsd(t, z) });
  }
  if (out.length === 0 || out[out.length - 1].t < tEnd - 1) {
    const z = joinedZ(tEnd, tNow, zNow);
    out.push({ t: tEnd, z, usd: quantilePriceUsd(tEnd, z) });
  }
  return out;
}
