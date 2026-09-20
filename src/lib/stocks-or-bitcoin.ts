import { HISTORY } from "@/lib/history";
import { assetSeries } from "@/lib/compare";
import { BETA, DAYS_PER_YEAR, GENESIS_UTC, MS_PER_DAY, isoFromDay } from "@/lib/powerlaw";

export const BTC_ORANGE = "#ff5a12";
export const SPX_WHITE = "#f4ead8";
export const SPX_LONG_RUN = 0.1;

export type VsPoint = { t: number; year: number; btc: number; spx: number };

function tFromUtc(ms: number): number {
  return Math.floor((ms - GENESIS_UTC) / MS_PER_DAY);
}

function lookup(series: { t: number; usd: number }[], t: number): number | null {
  if (series.length === 0) return null;
  if (t < series[0]!.t) return null;
  let lo = 0;
  let hi = series.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return series[lo]!.usd;
}

/** Forward 1-year return implied by P ∝ t^β. */
export function powerLawOneYearReturn(t: number): number {
  if (t <= 0) return Number.NaN;
  return (t + DAYS_PER_YEAR) ** BETA / t ** BETA - 1;
}

/** Monthly power-law 1y return vs a flat S&P long-run, 2015 → 2070. */
export function diminishingReturnSeries(): VsPoint[] {
  const start = tFromUtc(Date.UTC(2015, 0, 1));
  const end = tFromUtc(Date.UTC(2070, 0, 1));
  const out: VsPoint[] = [];
  for (let t = start; t <= end; t += 30) {
    const iso = isoFromDay(t);
    out.push({
      t,
      year: Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12,
      btc: powerLawOneYearReturn(t),
      spx: SPX_LONG_RUN,
    });
  }
  return out;
}

/** Growth of $1 in BTC vs S&P 500 total return from first overlapping close. */
export function dollarGrowthSeries(): VsPoint[] {
  const spx = assetSeries("spx");
  const btc = HISTORY.filter((row) => row.usd > 0);
  if (spx.length === 0 || btc.length === 0) return [];
  const t0 = Math.max(spx[0]!.t, btc[0]!.t);
  const btc0 = lookup(btc, t0);
  const spx0 = lookup(spx, t0);
  if (!btc0 || !spx0) return [];
  const out: VsPoint[] = [];
  for (const row of btc) {
    if (row.t < t0) continue;
    if (out.length > 0 && row.t - out[out.length - 1]!.t < 10) continue;
    const s = lookup(spx, row.t);
    if (!s) continue;
    const iso = isoFromDay(row.t);
    out.push({
      t: row.t,
      year: Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12,
      btc: row.usd / btc0,
      spx: s / spx0,
    });
  }
  const lastBtc = btc[btc.length - 1]!;
  const lastSpx = lookup(spx, lastBtc.t);
  if (lastSpx && (out.length === 0 || out[out.length - 1]!.t !== lastBtc.t)) {
    const iso = isoFromDay(lastBtc.t);
    out.push({
      t: lastBtc.t,
      year: Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12,
      btc: lastBtc.usd / btc0,
      spx: lastSpx / spx0,
    });
  }
  return out;
}

export function nearestPoint(series: VsPoint[], t: number): VsPoint | null {
  if (series.length === 0) return null;
  let best = series[0]!;
  let bestD = Math.abs(best.t - t);
  for (const pt of series) {
    const d = Math.abs(pt.t - t);
    if (d < bestD) {
      best = pt;
      bestD = d;
    }
  }
  return best;
}

export function crossoverT(): number {
  const target = 1 + SPX_LONG_RUN;
  let lo = 2000;
  let hi = 80_000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (1 + powerLawOneYearReturn(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function formatReturnPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toLocaleString("en-CA", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

export function formatMultiple(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("en-CA", { maximumFractionDigits: 1 })} million×`;
  if (v >= 1_000) return `${v.toLocaleString("en-CA", { maximumFractionDigits: 0 })}×`;
  return `${v.toLocaleString("en-CA", { maximumFractionDigits: 1 })}×`;
}

export function formatAxisMultiple(v: number): string {
  if (!(v > 0)) return "—";
  const e = Math.round(Math.log10(v));
  if (e >= 6) return `${10 ** (e - 6)}M×`;
  if (e >= 3) return `${10 ** (e - 3)}k×`;
  return `${10 ** e}×`;
}
