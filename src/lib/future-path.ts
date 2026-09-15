import { GENESIS_UTC, MS_PER_DAY, SIGMA, log10Fair, quantilePriceUsd } from "@/lib/powerlaw";

/**
 * Hypothetical residual path around the power-law attractor.
 *
 * Santostasi (2026) DMD/SSA: the first eigenmode is the power law (~98.7% of
 * variance); a stable, slightly decaying oscillation at 1,530 days (4.19 y)
 * is the halving clock — peak-to-peak, not a symmetric sine. Real Bitcoin
 * bears are ~12 months peak-to-trough (2018, 2022; 2013–15 was ~14). The
 * oscillator is therefore skewed: ~18 months post-halving to the top, ~12
 * months down, then a grind into the next halving. Amplitude shrinks each
 * era (MVRV tops 5.88 → 4.72 → 3.96 → 2.74). Superposed: a 4-year
 * PPI/business-cycle term (trough with this bear, ~Oct 2026) and a 2028
 * US-election liquidity bump on the post-H5 bull.
 *
 * This is a scenario, not a forecast. The path is forced through today's
 * residual so it joins the real series without a jump.
 */

export const CYCLE_DAYS = 1530;
export const PEAK_LAG_DAYS = 540;
/** Historical peak-to-trough. 2018 and 2022 were ~12 months. */
const BEAR_DAYS = 365;
const AMP0 = 2.45;
const AMP_DECAY = 0.78;
const TROUGH_FRAC = -0.82;
const HALVING_FRAC = 0.12;
const PPI_DAYS = 1461;
const PPI_AMP = 0.18;
const ELECTION_AMP = 0.38;
const ELECTION_WIDTH = 95;
const MATCH_TAU = 120;

const HALVING_ISO = [
  "2012-11-28",
  "2016-07-09",
  "2020-05-11",
  "2024-04-20",
  "2028-04-17",
  "2032-04-20",
  "2036-04-22",
  "2040-04-24",
] as const;

const HALVING_T = HALVING_ISO.map((iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - GENESIS_UTC) / MS_PER_DAY);
});

const ELECTION_T = Math.floor((Date.UTC(2028, 10, 7) - GENESIS_UTC) / MS_PER_DAY);
const H5_T = HALVING_T[4];
const NEXT_PEAK_T = H5_T + PEAK_LAG_DAYS;
/** PPI trough with the bear low — Oct 2026, not mid-2027. */
const PPI_TROUGH_T = Math.floor((Date.UTC(2026, 9, 1) - GENESIS_UTC) / MS_PER_DAY);
const PPI_PEAK_T = PPI_TROUGH_T - PPI_DAYS / 2;

export type FuturePoint = { t: number; usd: number; z: number };

function lastHalvingT(t: number): number {
  let last = HALVING_T[0];
  for (const h of HALVING_T) {
    if (h <= t) last = h;
    else break;
  }
  return last;
}

function nextHalvingT(t: number): number {
  for (const h of HALVING_T) {
    if (h > lastHalvingT(t)) return h;
  }
  return lastHalvingT(t) + CYCLE_DAYS;
}

function eraIndex(t: number): number {
  let i = 0;
  for (let k = 0; k < HALVING_T.length; k++) {
    if (HALVING_T[k] <= t) i = k;
  }
  return i;
}

function smooth(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

function mix(a: number, b: number, u: number): number {
  return a + (b - a) * smooth(u);
}

/** +1 at the cycle top, TROUGH_FRAC at the 12-month low, small positive at the next halving. */
function cycleShape(dsh: number, span: number): number {
  const peak = PEAK_LAG_DAYS;
  const trough = peak + BEAR_DAYS;
  if (dsh <= peak) return mix(HALVING_FRAC, 1, dsh / Math.max(1, peak));
  if (dsh <= trough) return mix(1, TROUGH_FRAC, (dsh - peak) / BEAR_DAYS);
  return mix(TROUGH_FRAC, HALVING_FRAC, (dsh - trough) / Math.max(1, span - trough));
}

function cycleZ(t: number): number {
  const h = lastHalvingT(t);
  const span = Math.max(CYCLE_DAYS * 0.85, nextHalvingT(t) - h);
  const amp = AMP0 * AMP_DECAY ** eraIndex(t);
  return amp * cycleShape(t - h, span);
}

function ppiZ(t: number): number {
  return PPI_AMP * Math.cos(((t - PPI_PEAK_T) / PPI_DAYS) * Math.PI * 2);
}

function electionZ(t: number): number {
  const u = (t - ELECTION_T) / ELECTION_WIDTH;
  return ELECTION_AMP * Math.exp(-0.5 * u * u);
}

function millionZ(t: number): number {
  return (6 - log10Fair(t)) / SIGMA;
}

function freeZ(t: number): number {
  const base = cycleZ(t) + ppiZ(t) + electionZ(t);
  const u = (t - NEXT_PEAK_T) / 90;
  const w = Math.exp(-0.5 * u * u);
  if (w < 0.02) return base;
  return base + w * (millionZ(NEXT_PEAK_T) - cycleZ(NEXT_PEAK_T) - ppiZ(NEXT_PEAK_T));
}

export function projectedUsd(t: number, tNow: number, zNow: number): number {
  const offset = zNow - freeZ(tNow);
  const fade = Math.exp(-(Math.max(0, t - tNow)) / MATCH_TAU);
  const z = Math.min(2.25, Math.max(-2.15, freeZ(t) + offset * fade));
  return quantilePriceUsd(t, z);
}

export type FutureMark = {
  iso: string;
  t: number;
  label: string;
  tone: "bull";
  usd: number;
};

function isoAt(t: number): string {
  const d = new Date(GENESIS_UTC + Math.round(t) * MS_PER_DAY);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function futureEventMarks(tNow: number, zNow: number): FutureMark[] {
  const out: FutureMark[] = [];
  const nextH = HALVING_T.find((h) => h > tNow);
  if (nextH != null) {
    out.push({
      iso: isoAt(nextH),
      t: nextH,
      label: "5th halving",
      tone: "bull",
      usd: projectedUsd(nextH, tNow, zNow),
    });
  }
  if (ELECTION_T > tNow) {
    out.push({
      iso: isoAt(ELECTION_T),
      t: ELECTION_T,
      label: "US election",
      tone: "bull",
      usd: projectedUsd(ELECTION_T, tNow, zNow),
    });
  }
  if (NEXT_PEAK_T > tNow) {
    out.push({
      iso: isoAt(NEXT_PEAK_T),
      t: NEXT_PEAK_T,
      label: "$1M cycle peak",
      tone: "bull",
      usd: projectedUsd(NEXT_PEAK_T, tNow, zNow),
    });
  }
  return out;
}

export function futurePricePath(tNow: number, zNow: number, tEnd: number, step = 6): FuturePoint[] {
  if (!(tEnd > tNow) || tNow <= 0) return [];
  const offset = zNow - freeZ(tNow);
  const out: FuturePoint[] = [];
  for (let t = tNow; t <= tEnd; t += step) {
    const fade = Math.exp(-(t - tNow) / MATCH_TAU);
    const z = Math.min(2.25, Math.max(-2.15, freeZ(t) + offset * fade));
    out.push({ t, z, usd: quantilePriceUsd(t, z) });
  }
  if (out.length === 0 || out[out.length - 1].t < tEnd - 1) {
    const t = tEnd;
    const fade = Math.exp(-(t - tNow) / MATCH_TAU);
    const z = Math.min(2.25, Math.max(-2.15, freeZ(t) + offset * fade));
    out.push({ t, z, usd: quantilePriceUsd(t, z) });
  }
  return out;
}
