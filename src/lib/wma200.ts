import { HISTORY, type HistoryRow } from "@/lib/history";
import { isoFromDay } from "@/lib/powerlaw";

export const WMA_WEEKS = 200;
export const WMA_BIN = 0.2;
export const WMA_TAIL = 2.4;

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

/** Genesis 3 Jan 2009 is Saturday UTC, so Sundays are t ≡ 1 (mod 7). */
export function isSundayT(t: number): boolean {
  return ((Math.round(t) % 7) + 7) % 7 === 1;
}

export function wmaSeries(rows: HistoryRow[] = HISTORY): WmaDay[] {
  const sundays: Array<{ t: number; usd: number }> = [];
  for (const row of rows) {
    if (row.usd > 0 && isSundayT(row.t)) sundays.push({ t: row.t, usd: row.usd });
  }
  if (sundays.length < WMA_WEEKS) return [];

  const sundayWma: Array<{ t: number; wma: number }> = [];
  let run = 0;
  for (let i = 0; i < sundays.length; i++) {
    run += sundays[i]!.usd;
    if (i >= WMA_WEEKS) run -= sundays[i - WMA_WEEKS]!.usd;
    if (i >= WMA_WEEKS - 1) sundayWma.push({ t: sundays[i]!.t, wma: run / WMA_WEEKS });
  }
  if (sundayWma.length === 0) return [];

  const out: WmaDay[] = [];
  let j = 0;
  const first = sundayWma[0]!.t;
  for (const row of rows) {
    if (!(row.usd > 0) || row.t < first) continue;
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

function binOf(multiple: number, tail: number): number {
  if (multiple >= tail) return tail;
  return Math.floor(multiple / WMA_BIN + 1e-12) * WMA_BIN;
}

export function barColor(lo: number): string {
  if (lo < 1) return "#f07167";
  if (lo < 1.2) return "#e0b020";
  if (lo < 2) return "#5eead4";
  return "#2ab8a8";
}

export const WMA_LEGEND = [
  { lo: 0, label: "Below 1.0×", color: barColor(0.8) },
  { lo: 1, label: "1.0–1.2×", color: barColor(1.0) },
  { lo: 1.2, label: "1.2–2.0×", color: barColor(1.2) },
  { lo: 2, label: "≥2.0×", color: barColor(2.0) },
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
  const lo0 = Math.floor(Math.min(...multiples, current) / WMA_BIN + 1e-12) * WMA_BIN;
  const hi0 = Math.ceil(Math.max(...multiples, current) / WMA_BIN - 1e-12) * WMA_BIN;
  const tail = window === "all" ? WMA_TAIL : Math.max(hi0, WMA_BIN);
  const start = Math.max(0, lo0);
  const edges: number[] = [];
  for (let x = start; x < tail - 1e-9; x = Math.round((x + WMA_BIN) * 10) / 10) edges.push(x);
  const counts = new Map<number, number>();
  for (const e of edges) counts.set(e, 0);
  counts.set(tail, 0);
  for (const m of multiples) {
    const key = binOf(m, tail);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const n = slice.length;
  const bins: WmaBin[] = [];
  for (const e of edges) {
    const count = counts.get(e) ?? 0;
    bins.push({
      lo: e,
      hi: Math.round((e + WMA_BIN) * 10) / 10,
      label: binLabel(e, Math.round((e + WMA_BIN) * 10) / 10),
      count,
      share: count / n,
    });
  }
  const tailCount = counts.get(tail) ?? 0;
  if (window === "all" || tailCount > 0 || current >= tail) {
    bins.push({
      lo: tail,
      hi: null,
      label: binLabel(tail, null),
      count: tailCount,
      share: tailCount / n,
    });
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
