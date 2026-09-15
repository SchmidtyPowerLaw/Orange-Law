/**
 * Power-law model from Santostasi & Perrenod (2026),
 * "A Mechanistic Derivation of the Bitcoin Price Power Law".
 *
 * log10 P(t) = −16.509 + 5.690 log10(t)
 * t = integer days since the Genesis Block, 3 January 2009.
 * Residual σ = 0.302 dex (log-normal, stationary).
 */

export const GENESIS_UTC = Date.UTC(2009, 0, 3);
export const BETA = 5.69;
export const LOG10_INTERCEPT = -16.509;
export const SIGMA = 0.302;
export const R_SQUARED = 0.961;
export const T_MODEL_START = 560; // 17 July 2010
export const MS_PER_DAY = 86_400_000;
export const DAYS_PER_YEAR = 365.25;
export const MAX_TARGET_ISO = "2060-12-31";

export type QuantileId = "break" | "floor" | "low" | "fair" | "high" | "top";

export type Quantile = {
  id: QuantileId;
  z: number;
  p: number;
  label: string;
  short: string;
};

export const QUANTILES: readonly Quantile[] = [
  { id: "break", z: -3, p: 0.00135, label: "Break (−3σ)", short: "−3σ" },
  { id: "floor", z: -2, p: 0.0228, label: "Power law floor", short: "Floor" },
  { id: "low", z: -1, p: 0.1587, label: "Lower band (−1σ)", short: "−1σ" },
  { id: "fair", z: 0, p: 0.5, label: "Fair value", short: "Fair" },
  { id: "high", z: 1, p: 0.8413, label: "Upper band (+1σ)", short: "+1σ" },
  { id: "top", z: 2, p: 0.9772, label: "Cycle top (+2σ)", short: "Top" },
] as const;

export const PROJECTED_QUANTILES = QUANTILES.filter((q) => q.id !== "break");

export const HORIZONS_YEARS = [1, 3, 5, 10] as const;
export type HorizonYear = (typeof HORIZONS_YEARS)[number];

export function daysSinceGenesis(ms: number = Date.now()): number {
  return Math.floor((ms - GENESIS_UTC) / MS_PER_DAY);
}

export function dateFromDay(t: number): Date {
  return new Date(GENESIS_UTC + t * MS_PER_DAY);
}

export function isoFromDay(t: number): string {
  const d = dateFromDay(Math.round(t));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function log10Fair(t: number): number {
  if (t <= 0) return Number.NEGATIVE_INFINITY;
  return LOG10_INTERCEPT + BETA * Math.log10(t);
}

export function fairPriceUsd(t: number): number {
  return 10 ** log10Fair(t);
}

export function quantilePriceUsd(t: number, z: number): number {
  return 10 ** (log10Fair(t) + z * SIGMA);
}

export function residualZ(priceUsd: number, t: number): number {
  if (priceUsd <= 0 || t <= 0) return 0;
  return (Math.log10(priceUsd) - log10Fair(t)) / SIGMA;
}

export function residualZOf(price: number, t: number, scale = 1): number {
  const fair = fairPriceUsd(t) * scale;
  if (price <= 0 || fair <= 0 || t <= 0) return 0;
  return (Math.log10(price) - Math.log10(fair)) / SIGMA;
}

/** Pearson R² of log10(price) vs log10(t) on the inclusive [tMin, tMax] window. */
export function periodRSquared(
  points: Array<{ t: number; usd: number }>,
  tMin: number,
  tMax: number,
): number | null {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const point of points) {
    if (point.t < tMin || point.t > tMax || point.usd <= 0 || point.t <= 0) continue;
    const x = Math.log10(point.t);
    const y = Math.log10(point.usd);
    n += 1;
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  if (n < 3) return null;
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  if (vx <= 0 || vy <= 0) return null;
  const r = cov / Math.sqrt(vx * vy);
  if (!Number.isFinite(r)) return null;
  return r * r;
}

export function totalReturn(startPrice: number, endPrice: number): number {
  if (startPrice <= 0) return 0;
  return endPrice / startPrice - 1;
}

export function annualizedReturn(
  startPrice: number,
  endPrice: number,
  days: number,
): number {
  if (startPrice <= 0 || endPrice <= 0 || days <= 0) return 0;
  const years = days / DAYS_PER_YEAR;
  return (endPrice / startPrice) ** (1 / years) - 1;
}

export type ForwardCell = {
  z: number;
  id: QuantileId;
  short: string;
  label: string;
  price: number;
  total: number;
  cagr: number;
};

export type ForwardRow = {
  years: HorizonYear;
  days: number;
  t: number;
  cells: ForwardCell[];
};

export function forwardProjections(
  tNow: number,
  priceNow: number,
  fx: number,
): ForwardRow[] {
  return HORIZONS_YEARS.map((years) => {
    const days = Math.round(years * DAYS_PER_YEAR);
    const t = tNow + days;
    const cells = PROJECTED_QUANTILES.map((q) => {
      const price = quantilePriceUsd(t, q.z) * fx;
      return {
        z: q.z,
        id: q.id,
        short: q.short,
        label: q.label,
        price,
        total: totalReturn(priceNow, price),
        cagr: annualizedReturn(priceNow, price, days),
      };
    });
    return { years, days, t, cells };
  });
}

export type IsoParts = { y: number; m: number; d: number };

export function calendarIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIso(iso: string): IsoParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }
  return { y, m, d };
}

export function tFromIso(iso: string): number | null {
  const parts = parseIso(iso);
  if (!parts) return null;
  return daysSinceGenesis(Date.UTC(parts.y, parts.m - 1, parts.d));
}

export function shiftIsoYears(iso: string, years: number): string {
  const parts = parseIso(iso);
  if (!parts) return iso;
  return calendarIso(new Date(parts.y + years, parts.m - 1, parts.d));
}

export function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return calendarIso(d);
}

export function defaultTargetIso(): string {
  const iso = shiftIsoYears(calendarIso(), 5);
  return iso > MAX_TARGET_ISO ? MAX_TARGET_ISO : iso;
}

export type StackBand = ForwardCell & {
  p: number;
  stack: number;
};

export type StackProjection = {
  t: number;
  days: number;
  years: number;
  holdings: number;
  stackNow: number;
  bands: StackBand[];
};

export function stackProjection(
  tNow: number,
  priceNow: number,
  fx: number,
  tTarget: number,
  holdings: number,
): StackProjection | null {
  const days = tTarget - tNow;
  if (days <= 0 || holdings <= 0 || !Number.isFinite(holdings) || tTarget <= 0) {
    return null;
  }
  const bands = PROJECTED_QUANTILES.map((q) => {
    const price = quantilePriceUsd(tTarget, q.z) * fx;
    return {
      z: q.z,
      id: q.id,
      short: q.short,
      label: q.label,
      p: q.p,
      price,
      stack: price * holdings,
      total: totalReturn(priceNow, price),
      cagr: annualizedReturn(priceNow, price, days),
    };
  });
  return {
    t: tTarget,
    days,
    years: days / DAYS_PER_YEAR,
    holdings,
    stackNow: holdings * priceNow,
    bands,
  };
}
