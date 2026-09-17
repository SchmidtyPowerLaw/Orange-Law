import { HISTORY, type HistoryRow } from "@/lib/history";
import { dateFromDay, isoFromDay } from "@/lib/powerlaw";

export const WMA_WEEKS = 200;

export type WmaDay = {
  t: number;
  usd: number;
  wma: number;
  multiple: number;
};

export type CheapWindow = "all" | "365";

export type WmaBin = {
  lo: number;
  hi: number | null;
  label: string;
  count: number;
  share: number;
};

/** Lower edges matching the all-time cycle histogram. Last bin is ≥6.0×. */
export const CHEAP_EDGES = [
  0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 4.0, 5.0, 6.0,
] as const;

function isUtcSunday(t: number): boolean {
  return dateFromDay(Math.round(t)).getUTCDay() === 0;
}

/**
 * 200-week MA as of each day: SMA of the last 200 Sunday closes on or
 * before that day (forward-filled). Same definition as the cycle chart.
 */
export function wmaSeries(rows: HistoryRow[] = HISTORY): WmaDay[] {
  const sundays: Array<{ t: number; usd: number }> = [];
  for (const row of rows) {
    if (row.usd > 0 && isUtcSunday(row.t)) sundays.push({ t: row.t, usd: row.usd });
  }
  if (sundays.length < WMA_WEEKS) return [];

  const sundayWma: Array<{ t: number; wma: number }> = [];
  let run = 0;
  for (let i = 0; i < sundays.length; i++) {
    run += sundays[i]!.usd;
    if (i >= WMA_WEEKS) run -= sundays[i - WMA_WEEKS]!.usd;
    if (i >= WMA_WEEKS - 1) sundayWma.push({ t: sundays[i]!.t, wma: run / WMA_WEEKS });
  }

  const out: WmaDay[] = [];
  let j = 0;
  const start = sundayWma[0]!.t;
  for (const row of rows) {
    if (!(row.usd > 0) || row.t < start) continue;
    while (j + 1 < sundayWma.length && sundayWma[j + 1]!.t <= row.t) j++;
    const wma = sundayWma[j]!.wma;
    if (!(wma > 0)) continue;
    out.push({ t: row.t, usd: row.usd, wma, multiple: row.usd / wma });
  }
  return out;
}

export const WMA_DAYS = wmaSeries();

function binLabel(lo: number, hi: number | null): string {
  if (hi == null) return `≥${lo.toFixed(1)}×`;
  return `${lo.toFixed(1)}–${hi.toFixed(1)}×`;
}

/** First edge i such that lo[i] <= m < lo[i]+0.2; last bin is ≥ last edge. */
export function binIndex(multiple: number, edges: readonly number[]): number {
  if (multiple < edges[0]!) return 0;
  for (let i = 0; i < edges.length - 1; i++) {
    if (multiple < edges[i + 1]!) return i;
  }
  return edges.length - 1;
}

export function barColor(lo: number): string {
  if (lo < 1) return "#f07167";
  if (lo < 1.2) return "#e0b020";
  if (lo < 2) return "#5eead4";
  if (lo < 4) return "#2ab8a8";
  return "#5b9cf5";
}

export const WMA_LEGEND = [
  { lo: 0, label: "Below 1.0×", color: barColor(0.8) },
  { lo: 1, label: "1.0–1.2×", color: barColor(1.0) },
  { lo: 1.2, label: "1.2–2.0×", color: barColor(1.2) },
  { lo: 2, label: "2.0–4.0×", color: barColor(2.0) },
  { lo: 4, label: "≥4.0×", color: barColor(4.0) },
] as const;

export function cheapHistogram(
  window: CheapWindow,
  liveUsd = 0,
  days: WmaDay[] = WMA_DAYS,
): {
  bins: WmaBin[];
  current: number;
  wma: number;
  days: number;
  tMin: number;
  tMax: number;
  belowShare: number;
  cheaperShare: number;
  fromIso: string;
  toIso: string;
} | null {
  const slice = window === "365" ? days.slice(-365) : days;
  if (slice.length === 0) return null;
  const last = slice[slice.length - 1]!;
  const usd = liveUsd > 0 ? liveUsd : last.usd;
  const current = usd / last.wma;
  const multiples = slice.map((d) => d.multiple);

  const edges: number[] = [...CHEAP_EDGES];
  const counts = edges.map(() => 0);
  for (const m of multiples) counts[binIndex(m, edges)]! += 1;

  const n = slice.length;
  let bins: WmaBin[] = edges.map((lo, i) => {
    const isLast = i === edges.length - 1;
    const hi = isLast ? null : edges[i + 1]!;
    const count = counts[i]!;
    return { lo, hi, label: binLabel(lo, hi), count, share: count / n };
  });
  if (window === "365") {
    const curI = bins.findIndex((b, i, arr) =>
      i === arr.length - 1 ? current >= b.lo : current >= b.lo && current < (b.hi ?? Infinity),
    );
    let first = bins.findIndex((b) => b.count > 0);
    if (first < 0) first = 0;
    if (curI >= 0 && curI < first) first = curI;
    let last = bins.length - 1;
    while (last > first && bins[last]!.count === 0 && last !== curI) last--;
    bins = bins.slice(first, last + 1);
  }

  const below = multiples.filter((m) => m < 1).length;
  const cheaper = multiples.filter((m) => m < current).length;
  return {
    bins,
    current,
    wma: last.wma,
    days: n,
    tMin: slice[0]!.t,
    tMax: last.t,
    belowShare: below / n,
    cheaperShare: cheaper / n,
    fromIso: isoFromDay(slice[0]!.t),
    toIso: isoFromDay(last.t),
  };
}
